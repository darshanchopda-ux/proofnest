import "server-only";
import { get } from "@vercel/blob";
import { and, eq, gt, sql } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db";
import { agreements, aiRuns, type AgreementClause, type AgreementFacts, type AgreementFile, type Flat, type Photo } from "@/db/schema";
import { fmtDate, money } from "@/lib/format";
import { EXAMPLE_CONTENT_TYPE } from "@/lib/flats";
import type { WorkflowUsage } from "@/lib/n8n";

/** Most photos sent to the AI per check. Each is resized to 1568px on its long edge. */
export const MAX_IMAGES = 8;
const RUNS_PER_HOUR = 15;
/** Most files in one agreement read: a PDF, or one photo per page. */
export const AGREEMENT_MAX_FILES = 15;
/** Most base64 characters of agreement files per read, to stay under n8n's default 16 MB request limit. */
export const AGREEMENT_MAX_BASE64 = 12_000_000;

/** Optional model and thinking overrides passed to the n8n workflows (unset: the workflows' own defaults). */
export function aiOptions(): { model?: string; thinkingLevel?: string } {
  const options: { model?: string; thinkingLevel?: string } = {};
  if (process.env.AI_MODEL) options.model = process.env.AI_MODEL;
  if (process.env.AI_THINKING_LEVEL) options.thinkingLevel = process.env.AI_THINKING_LEVEL;
  return options;
}

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

/** Reads an uploaded agreement file for the AI: PDFs as they are, photos shrunk to 2000px. Returns null if it can't be read. */
export async function agreementFileForAI(f: AgreementFile): Promise<{ name: string; mediaType: string; data: string } | null> {
  try {
    const blob = await get(f.pathname, { access: "private" });
    if (!blob || blob.statusCode !== 200) return null;
    const original = Buffer.from(await new Response(blob.stream).arrayBuffer());
    if (blob.blob.contentType === "application/pdf") return { name: f.name, mediaType: "application/pdf", data: original.toString("base64") };
    const small = await sharp(original).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    return { name: f.name, mediaType: "image/jpeg", data: small.toString("base64") };
  } catch (e) {
    console.error("Couldn't prepare agreement file for the AI", f.pathname, e);
    return null;
  }
}

const CLAUSE_TOPICS = ["Deposit refund", "Painting", "Deductions", "Repairs and maintenance", "Lock-in", "Notice period", "Rent increase", "Other"];

/** Checks and cleans what the AI read from an agreement. Anything missing or malformed becomes empty. */
export function normalizeAgreement(raw: unknown): { isAgreement: boolean; facts: AgreementFacts; clauses: AgreementClause[]; flags: string[]; pageCount: number } {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const num = (v: unknown) => {
    if (v == null || v === "") return null;
    const x = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.]/g, ""));
    return Number.isFinite(x) && x >= 0 && x < 1e10 ? x : null;
  };
  // Real calendar dates only, so a misread "2024-02-30" never reaches a date column.
  const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v + "T00:00:00Z").toISOString().startsWith(v) ? v : "");
  const refund = num(d.refundDays);
  const clauses = (Array.isArray(d.clauses) ? d.clauses : []).slice(0, 12).map((c): AgreementClause => {
    const x = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
    const topic = str(x.topic, 40);
    return { topic: CLAUSE_TOPICS.includes(topic) ? topic : "Other", clause: str(x.clause, 20), quote: str(x.quote, 400), plain: str(x.plain, 240) };
  });
  return {
    isAgreement: d.isAgreement !== false,
    facts: {
      owner: str(d.ownerName, 120),
      tenant: str(d.tenantName, 120),
      address: str(d.address),
      agreementDate: day(d.agreementDate),
      start: day(d.startDate),
      end: day(d.endDate),
      rent: num(d.monthlyRent),
      deposit: num(d.securityDeposit),
      maintenance: str(d.maintenance, 160),
      lockIn: str(d.lockIn, 160),
      notice: str(d.noticePeriod, 160),
      refundDays: refund != null && refund <= 365 ? Math.round(refund) : null,
    },
    clauses: clauses.filter((c) => c.quote || c.plain),
    flags: (Array.isArray(d.watchOut) ? d.watchOut : []).slice(0, 5).map((x) => str(x)).filter(Boolean),
    pageCount: Math.round(num(d.pageCount) ?? 0),
  };
}

/** The agreement's key terms as plain text for the prompts, or null when none was uploaded. */
export async function agreementSummary(flatId: string): Promise<string | null> {
  const [ag] = await db.select().from(agreements).where(eq(agreements.flatId, flatId)).limit(1);
  if (!ag) return null;
  const f = ag.facts;
  const lines: string[] = [];
  if (f.agreementDate) lines.push("Agreement date: " + f.agreementDate);
  if (f.start || f.end) lines.push(`Period: ${f.start || "?"} to ${f.end || "?"}`);
  if (f.rent != null) lines.push("Rent in agreement: " + money(f.rent));
  if (f.deposit != null) lines.push("Deposit in agreement: " + money(f.deposit));
  if (f.refundDays != null) lines.push("Deposit refund: " + (f.refundDays === 0 ? "at the time of vacating or handover" : `${f.refundDays} days after handover`));
  if (f.lockIn) lines.push("Lock-in: " + f.lockIn);
  if (f.notice) lines.push("Notice period: " + f.notice);
  if (f.maintenance) lines.push("Maintenance: " + f.maintenance);
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
