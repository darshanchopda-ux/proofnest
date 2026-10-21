import "server-only";
import { get } from "@vercel/blob";
import { and, eq, gt, sql } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db";
import { agreements, aiRuns, type Flat, type Photo } from "@/db/schema";
import { fmtDate } from "@/lib/format";
import { EXAMPLE_CONTENT_TYPE } from "@/lib/flats";
import type { WorkflowUsage } from "@/lib/n8n";

/** Most photos sent to the AI per check. Each is resized to 1568px on its long edge. */
export const MAX_IMAGES = 8;
const RUNS_PER_HOUR = 15;

export function flatFacts(flat: Flat) {
  return {
    address: flat.address,
    ownerName: flat.ownerName,
    tenantName: flat.tenantName,
    moveIn: flat.moveIn,
    keysHandedOver: flat.keysHandedOver,
    monthlyRent: flat.monthlyRent == null ? null : Number(flat.monthlyRent),
    deposit: flat.deposit == null ? null : Number(flat.deposit),
  };
}

export function photoMeta(p: Photo) {
  return { n: p.n, room: p.room, condition: p.condition, note: p.note, takenAt: p.takenAt ? fmtDate(p.takenAt) : null };
}

/** Picks the photos most likely to matter for these deductions: rooms named in the list, then damaged or worn ones. */
export function pickPhotos(photos: Photo[], deductions: string, max = MAX_IMAGES): Photo[] {
  const text = deductions.toLowerCase();
  return photos
    .filter((p) => p.contentType !== EXAMPLE_CONTENT_TYPE && p.blobPathname)
    .map((p) => {
      let score = 0;
      const room = p.room.toLowerCase();
      if (room && text.includes(room)) score += 4;
      for (const w of room.split(/\s+/)) if (w.length > 3 && text.includes(w)) score += 2;
      for (const w of p.note.toLowerCase().split(/[^a-z]+/)) if (w.length > 4 && text.includes(w)) score += 1;
      score += p.condition === "damaged" ? 3 : p.condition === "worn" ? 1 : 0;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score || a.p.n - b.p.n)
    .slice(0, max)
    .map((x) => x.p);
}

/** Reads a private photo and shrinks it for the AI. Returns null if it can't be read. */
export async function photoForAI(p: Photo): Promise<{ label: string; mediaType: string; data: string } | null> {
  try {
    const blob = await get(p.blobPathname, { access: "private" });
    if (!blob || blob.statusCode !== 200) return null;
    const original = Buffer.from(await new Response(blob.stream).arrayBuffer());
    const small = await sharp(original).rotate().resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    return { label: `P${p.n} (${p.room})`, mediaType: "image/jpeg", data: small.toString("base64") };
  } catch (e) {
    console.error("Couldn't prepare photo for the AI", p.id, e);
    return null;
  }
}

export async function imageFileForAI(file: File): Promise<{ mediaType: string; data: string } | null> {
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const small = await sharp(buf).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    return { mediaType: "image/jpeg", data: small.toString("base64") };
  } catch {
    return null;
  }
}

/** The agreement's key terms as plain text for the prompts, or null when none was uploaded. */
export async function agreementSummary(flatId: string): Promise<string | null> {
  const [ag] = await db.select().from(agreements).where(eq(agreements.flatId, flatId)).limit(1);
  if (!ag) return null;
  const f = ag.facts;
  const lines: string[] = [];
  if (f.agreementDate) lines.push("Agreement date: " + f.agreementDate);
  if (f.refundDays != null) lines.push("Deposit refund: " + (f.refundDays === 0 ? "at the time of vacating or handover" : `${f.refundDays} days after handover`));
  if (f.lockIn) lines.push("Lock-in: " + f.lockIn);
  if (f.notice) lines.push("Notice period: " + f.notice);
  for (const k of ag.clauses) lines.push(`- ${k.topic}${k.clause ? ` (clause ${k.clause})` : ""}: ${k.quote ? `"${k.quote}"` : k.plain}`);
  return lines.join("\n") || null;
}

/** True when this flat has used up its hourly allowance of AI calls. */
export async function overRunLimit(flatId: string): Promise<boolean> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(aiRuns)
    .where(and(eq(aiRuns.flatId, flatId), gt(aiRuns.createdAt, sql`now() - interval '1 hour'`)));
  return (row?.n ?? 0) >= RUNS_PER_HOUR;
}

export async function logRun(flatId: string, kind: "check" | "letter" | "agreement", started: number, result: { ok: boolean; model?: string; usage?: WorkflowUsage; error?: string }) {
  await db.insert(aiRuns).values({
    flatId,
    kind,
    status: result.ok ? "ok" : "error",
    model: result.model ?? "",
    inputTokens: result.usage?.input_tokens ?? null,
    outputTokens: result.usage?.output_tokens ?? null,
    latencyMs: Date.now() - started,
    error: result.ok ? null : (result.error ?? "").slice(0, 500),
  });
}
