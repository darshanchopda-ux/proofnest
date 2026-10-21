import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { charges, flats, photos } from "@/db/schema";
import { agreementSummary, aiOptions, flatFacts, imageFileForAI, logRun, overRunLimit, photoForAI, photoMeta, pickPhotos } from "@/lib/ai";
import { getCurrentUser } from "@/lib/dal";
import { getOwnedFlat, listCharges } from "@/lib/flats";
import { evidenceWithOwnerReview } from "@/lib/owner-review";
import { callWorkflow } from "@/lib/n8n";
import type { Decision } from "@/lib/types";

// The model reads photos and thinks before answering; a check can take a minute or two.
export const maxDuration = 300;

type CheckReply = {
  ok: true;
  charges: { item: string; amount: number; verdict: string; photos: string[]; reason: string; confidence: number }[];
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number } | null;
};

const VERDICTS: Decision[] = ["already_there", "wear_and_tear", "no_receipt", "check", "likely_valid"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in to check deductions." }, { status: 401 });
  const flat = await getOwnedFlat(user.id, id);
  if (!flat) return NextResponse.json({ ok: false, error: "That flat wasn't found in your account." }, { status: 404 });

  const form = await request.formData();
  const deductions = String(form.get("deductions") ?? "").trim().slice(0, 10000);
  const shot = form.get("screenshot");
  const screenshotFile = shot instanceof File && shot.size > 0 ? shot : null;
  if (!deductions && !screenshotFile) {
    return NextResponse.json({ ok: false, error: "Paste the owner's deductions first, or add a screenshot of them." }, { status: 400 });
  }
  if (await overRunLimit(flat.id)) {
    return NextResponse.json({ ok: false, error: "That's a lot of checks in the last hour. Wait a little, then try again." }, { status: 429 });
  }

  await db.update(flats).set({ deductionsText: deductions, stage: "moveout", updatedAt: new Date() }).where(eq(flats.id, flat.id));

  const allPhotos = await db.select().from(photos).where(eq(photos.flatId, flat.id)).orderBy(asc(photos.n));
  const chosen = pickPhotos(allPhotos, deductions, screenshotFile ? 7 : 8);
  const [images, screenshot, agreement] = await Promise.all([
    Promise.all(chosen.map(photoForAI)),
    screenshotFile ? imageFileForAI(screenshotFile) : Promise.resolve(null),
    agreementSummary(flat.id),
  ]);

  const started = Date.now();
  const reply = await callWorkflow<CheckReply>("proofnest-check", {
    ...aiOptions(),
    flat: flatFacts(flat),
    deductions,
    evidence: await evidenceWithOwnerReview(flat.id, flat.evidenceNotes),
    photos: allPhotos.map(photoMeta),
    images: images.filter(Boolean),
    screenshot,
    agreement,
  });
  await logRun(flat.id, "check", started, reply.ok ? { ok: true, model: reply.model, usage: reply.usage } : { ok: false, error: reply.error, model: reply.model, usage: reply.usage });
  if (!reply.ok) {
    const status = reply.code === "not_configured" ? 503 : reply.code === "busy" ? 429 : 502;
    return NextResponse.json({ ok: false, code: reply.code, error: reply.error }, { status });
  }

  // Replace earlier AI verdicts; charges the tenant added by hand stay.
  const known = new Set(allPhotos.map((p) => p.n));
  const rows = reply.charges.slice(0, 60).map((c, i) => {
    const verdict = VERDICTS.includes(c.verdict as Decision) ? (c.verdict as Decision) : "check";
    const photoNs = [...new Set((c.photos ?? []).map((t) => parseInt(String(t).replace(/\D/g, ""), 10)).filter((n) => known.has(n)))].slice(0, 6);
    const confidence = Number(c.confidence);
    const amount = Number(c.amount);
    return {
      flatId: flat.id,
      position: i,
      item: String(c.item || "Charge").slice(0, 160),
      amount: (Number.isFinite(amount) && amount >= 0 ? amount : 0).toFixed(2),
      aiVerdict: verdict,
      decision: verdict,
      photoNs,
      reason: String(c.reason || "").slice(0, 500),
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
      source: "ai",
    };
  });
  await db.delete(charges).where(and(eq(charges.flatId, flat.id), eq(charges.source, "ai")));
  if (rows.length) await db.insert(charges).values(rows);
  await db.update(flats).set({ analyzedAt: new Date() }).where(eq(flats.id, flat.id));

  return NextResponse.json({
    ok: true,
    charges: await listCharges(flat.id),
    photosShown: chosen.map((p) => p.n),
    analyzedAt: new Date().toISOString(),
  });
}
