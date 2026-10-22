import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agreements, type AgreementFile } from "@/db/schema";
import { AGREEMENT_MAX_BASE64, AGREEMENT_MAX_FILES, agreementFileForAI, aiOptions, finishRun, normalizeAgreement, overRunLimit, startRun } from "@/lib/ai";
import { removeBlobs } from "@/lib/blobs";
import { getCurrentUser } from "@/lib/dal";
import { getOwnedFlat, toAgreementDTO } from "@/lib/flats";
import { callWorkflow, type WorkflowUsage } from "@/lib/n8n";

export const maxDuration = 300;

// The browser converts HEIC and other photo formats to JPEG before uploading an agreement.
const TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

type AgreementReply = { ok: true; agreement: unknown; model?: string; usage?: WorkflowUsage };

/**
 * Reads the rent agreement the browser just uploaded (or pasted text) with the AI and saves its key terms.
 * Body: { files: [{ pathname, name, contentType, sizeBytes }], text }. Replaces any earlier agreement.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in to add your agreement." }, { status: 401 });
  const flat = await getOwnedFlat(user.id, id);
  if (!flat) return NextResponse.json({ ok: false, error: "That flat wasn't found in your account." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { files?: unknown; text?: unknown } | null;
  const folder = `flats/${flat.id}/agreement/`;
  const files: AgreementFile[] = (Array.isArray(body?.files) ? body.files : []).map((f: Record<string, unknown> | null) => ({
    pathname: String(f?.pathname ?? ""),
    name: String(f?.name ?? "agreement").slice(0, 80),
    contentType: String(f?.contentType ?? ""),
    sizeBytes: Math.max(0, Number(f?.sizeBytes) || 0),
  }));
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 60000) : "";
  // Files this request uploaded are deleted again if reading fails, so a failed read leaves nothing behind.
  const [current] = await db.select({ files: agreements.files }).from(agreements).where(eq(agreements.flatId, flat.id)).limit(1);
  const saved = new Set((current?.files ?? []).map((f) => f.pathname));
  const inFolder = (f: AgreementFile) => f.pathname.startsWith(folder) && !f.pathname.includes("..");
  const fresh = files.filter((f) => inFolder(f) && !saved.has(f.pathname)).map((f) => f.pathname);
  const fail = async (status: number, error: string, code?: string) => {
    await removeBlobs(fresh);
    return NextResponse.json({ ok: false, code, error }, { status });
  };

  if (files.some((f) => !inFolder(f) || !TYPES.includes(f.contentType))) return fail(400, "Upload the agreement again, as a PDF or photos.");
  if (!files.length && !text) return fail(400, "Upload your agreement, or paste its text.");
  if (files.length > AGREEMENT_MAX_FILES) return fail(400, `Upload at most ${AGREEMENT_MAX_FILES} files: a PDF, or one photo per page.`);
  if (await overRunLimit(user.id)) return fail(429, "That's a lot of requests in the last hour. Wait a little, then try again.");

  const prepared = await Promise.all(files.map(agreementFileForAI));
  if (prepared.some((p) => !p)) return fail(400, "One of the files couldn't be opened. Upload it again as a PDF or photo.");
  if (prepared.reduce((n, p) => n + p!.data.length, 0) > AGREEMENT_MAX_BASE64) {
    return fail(413, "The agreement is too large to read in one go. Upload a smaller PDF, or photos of the pages instead.", "too_large");
  }

  const run = await startRun(flat.id, "agreement");
  const reply = await callWorkflow<AgreementReply>("proofnest-agreement", { ...aiOptions(), files: prepared, text });
  await finishRun(run, reply.ok ? { ok: true, model: reply.model, usage: reply.usage } : { ok: false, error: reply.error, model: reply.model, usage: reply.usage });
  if (!reply.ok) return fail(reply.code === "not_configured" ? 503 : reply.code === "busy" ? 429 : 502, reply.error, reply.code);

  const ag = normalizeAgreement(reply.agreement);
  const found = ag.clauses.length > 0 || Object.values(ag.facts).some((v) => v !== "" && v != null);
  if (!ag.isAgreement || !found) return fail(422, "That doesn't look like a rent agreement. Upload all of its pages, or paste its text.", "not_agreement");

  const values = { files, facts: ag.facts, clauses: ag.clauses, flags: ag.flags, text, pages: ag.pageCount || files.length, readAt: new Date(), dismissed: false };
  const [row] = await db.insert(agreements).values({ flatId: flat.id, ...values }).onConflictDoUpdate({ target: agreements.flatId, set: values }).returning();
  const kept = new Set(files.map((f) => f.pathname));
  await removeBlobs((current?.files ?? []).map((f) => f.pathname).filter((p) => !kept.has(p)));
  return NextResponse.json({ ok: true, agreement: toAgreementDTO(row) });
}
