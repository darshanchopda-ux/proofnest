import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { flats, ownerReviews, type OwnerReview, type Photo, type ReviewPhoto } from "@/db/schema";
import { fmtDate } from "@/lib/format";
import type { OwnerReviewDTO } from "@/lib/types";

export function newReviewToken(): string {
  return randomBytes(24).toString("base64url");
}

/** The photos exactly as the owner will see them; later edits to the flat don't change what they confirmed. */
export function snapshotPhotos(rows: Photo[]): ReviewPhoto[] {
  return [...rows]
    .sort((a, b) => a.n - b.n)
    .map((p) => ({
      id: p.id,
      n: p.n,
      room: p.room,
      condition: p.condition,
      note: p.note,
      sha256: p.sha256,
      takenAt: p.takenAt ? p.takenAt.toISOString() : null,
      takenFrom: p.takenFrom,
      capture: p.capture === "live" ? "live" : "upload",
      phase: p.phase === "moveout" ? "moveout" : "movein",
    }));
}

export function recordHash(snapshot: ReviewPhoto[]): string {
  return createHash("sha256").update(JSON.stringify(snapshot.map((p) => [p.n, p.room, p.condition, p.note, p.sha256, p.takenAt]))).digest("hex");
}

/** True when the tenant has added, removed or re-described photos since the link was made. */
export function isStale(review: OwnerReview, current: Photo[]): boolean {
  return recordHash(review.photos) !== recordHash(snapshotPhotos(current));
}

export type ReviewKind = "movein" | "moveout";

export async function latestReview(flatId: string, kind: ReviewKind = "movein"): Promise<OwnerReview | null> {
  const [row] = await db
    .select()
    .from(ownerReviews)
    .where(and(eq(ownerReviews.flatId, flatId), eq(ownerReviews.kind, kind)))
    .orderBy(desc(ownerReviews.createdAt))
    .limit(1);
  return row ?? null;
}

export function toOwnerReviewDTO(r: OwnerReview, current: Photo[]): OwnerReviewDTO {
  return {
    token: r.token,
    status: r.status,
    kind: r.kind === "moveout" ? "moveout" : "movein",
    ownerRole: r.ownerRole,
    photoNs: r.photos.map((p) => p.n),
    ownerName: r.ownerName,
    ownerNote: r.ownerNote,
    createdAt: r.createdAt.toISOString(),
    respondedAt: r.respondedAt ? r.respondedAt.toISOString() : null,
    recordHash: r.recordHash,
    stale: isStale(r, current),
  };
}

/** The owner's most recent answer, which stays the evidence while a newer link waits for an answer. */
export async function latestAnswered(flatId: string, kind: ReviewKind = "movein"): Promise<OwnerReview | null> {
  const [row] = await db
    .select()
    .from(ownerReviews)
    .where(and(eq(ownerReviews.flatId, flatId), eq(ownerReviews.kind, kind), isNotNull(ownerReviews.respondedAt)))
    .orderBy(desc(ownerReviews.respondedAt))
    .limit(1);
  return row ?? null;
}

/** An active link and the flat it belongs to, for the owner's page. Null if the link is wrong or was replaced. */
export async function reviewByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const [row] = await db
    .select({ review: ownerReviews, flat: { id: flats.id, address: flats.address, ownerName: flats.ownerName, tenantName: flats.tenantName, moveIn: flats.moveIn, keysHandedOver: flats.keysHandedOver } })
    .from(ownerReviews)
    .innerJoin(flats, eq(ownerReviews.flatId, flats.id))
    .where(and(eq(ownerReviews.token, token), isNull(ownerReviews.revokedAt)))
    .limit(1);
  return row ?? null;
}

export const OWNER_ROLES: Record<string, string> = { owner: "the owner", agent: "the owner's broker or agent", family: "a family member of the owner" };

/** "Asha (the owner's broker or agent)", or just the name when they didn't say who they are. */
export function answeredBy(r: Pick<OwnerReview, "ownerName" | "ownerRole">): string {
  return OWNER_ROLES[r.ownerRole] ? `${r.ownerName} (${OWNER_ROLES[r.ownerRole]})` : r.ownerName;
}

/**
 * Lines for the AI prompts saying what the owner said about the move-in and move-out records, or "" if they haven't answered.
 * The owner's name and note are their own words, so they are quoted as data rather than written as instructions.
 */
export async function ownerReviewEvidence(flatId: string): Promise<string> {
  const answers = await Promise.all((["movein", "moveout"] as const).map((k) => latestAnswered(flatId, k)));
  return answers
    .filter((r): r is OwnerReview => !!r?.respondedAt)
    .map((r) => {
      const record = r.kind === "moveout" ? "move-out (handover)" : "move-in";
      const ns = r.photos.map((p) => `P${p.n}`).join(", ");
      const when = fmtDate(r.respondedAt!);
      const who = `${JSON.stringify(r.ownerName.slice(0, 120))}${OWNER_ROLES[r.ownerRole] ? `, ${OWNER_ROLES[r.ownerRole]}` : ""}`;
      return r.status === "confirmed"
        ? `The owner's side (signed as ${who}) confirmed the tenant's ${record} record on ${when} through a ProofNest link, covering photos ${ns}.`
        : `The owner's side (signed as ${who}) disputed the tenant's ${record} record on ${when}. Their note, quoted as written: ${JSON.stringify(r.ownerNote.slice(0, 500))}`;
    })
    .join("\n");
}

/** Puts the owner's answer in front of the tenant's own evidence notes. */
export async function evidenceWithOwnerReview(flatId: string, notes: string): Promise<string> {
  const line = await ownerReviewEvidence(flatId);
  return [line, notes].filter((x) => x.trim()).join("\n");
}
