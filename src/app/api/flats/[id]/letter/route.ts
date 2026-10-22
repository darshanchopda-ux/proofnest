import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { flats, photos, refundEntries } from "@/db/schema";
import { agreementSummary, aiOptions, finishRun, flatFacts, overRunLimit, photoMeta, startRun } from "@/lib/ai";
import { getCurrentUser } from "@/lib/dal";
import { getOwnedFlat, listCharges } from "@/lib/flats";
import { fmtDate } from "@/lib/format";
import { evidenceWithOwnerReview } from "@/lib/owner-review";
import { callWorkflow } from "@/lib/n8n";

export const maxDuration = 300;

type LetterReply = { ok: true; letter: string; truncated?: boolean; model?: string; usage?: { input_tokens?: number; output_tokens?: number } | null };

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in to write your letter." }, { status: 401 });
  const flat = await getOwnedFlat(user.id, id);
  if (!flat) return NextResponse.json({ ok: false, error: "That flat wasn't found in your account." }, { status: 404 });

  // Charges where the tenant said the AI was wrong go without the AI's verdict and reason; only the tenant's decision counts.
  const chargeList = (await listCharges(flat.id)).map((c) => (c.aiFlagged ? { ...c, aiVerdict: null, reason: "", confidence: null } : c));
  if (!chargeList.length) return NextResponse.json({ ok: false, error: "Check your deductions in step 3 first." }, { status: 400 });
  if (await overRunLimit(user.id)) {
    return NextResponse.json({ ok: false, error: "That's a lot of requests in the last hour. Wait a little, then try again." }, { status: 429 });
  }

  const cited = new Set(chargeList.flatMap((c) => c.photoNs));
  const allPhotos = await db.select().from(photos).where(eq(photos.flatId, flat.id)).orderBy(asc(photos.n));

  const run = await startRun(flat.id, "letter");
  const reply = await callWorkflow<LetterReply>("proofnest-letter", {
    ...aiOptions(),
    flat: flatFacts(flat),
    today: fmtDate(new Date()),
    charges: chargeList,
    citedPhotos: allPhotos.filter((p) => cited.has(p.n)).map(photoMeta),
    evidence: await evidenceWithOwnerReview(flat.id, flat.evidenceNotes),
    agreement: await agreementSummary(flat.id),
    language: flat.letterLanguage || "English",
    refunds: (await db.select().from(refundEntries).where(eq(refundEntries.flatId, flat.id)).orderBy(asc(refundEntries.on))).map((r) => ({
      kind: r.kind,
      amount: Number(r.amount),
      on: r.on ? fmtDate(r.on) : null,
      note: r.note,
    })),
  });
  await finishRun(run, reply.ok ? { ok: true, model: reply.model, usage: reply.usage } : { ok: false, error: reply.error, model: reply.model, usage: reply.usage });
  if (!reply.ok) {
    const status = reply.code === "not_configured" ? 503 : reply.code === "busy" ? 429 : 502;
    return NextResponse.json({ ok: false, code: reply.code, error: reply.error }, { status });
  }

  const letter = reply.letter.slice(0, 20000);
  await db.update(flats).set({ letter, updatedAt: new Date() }).where(eq(flats.id, flat.id));
  return NextResponse.json({ ok: true, letter, truncated: Boolean(reply.truncated) });
}
