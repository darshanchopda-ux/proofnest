import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agreements, charges, flats, photos, type Agreement, type Charge, type Flat, type Photo } from "@/db/schema";
import type { AgreementDTO, ChargeDTO, FlatDTO, PhotoDTO } from "@/lib/types";
import { isUuid } from "@/lib/dal";
import { dayCode } from "@/lib/evidence";
import { latestAnswered, latestReview, toOwnerReviewDTO } from "@/lib/owner-review";

export const EXAMPLE_CONTENT_TYPE = "example";

export async function listFlats(userId: string) {
  return db
    .select({ id: flats.id, address: flats.address, isExample: flats.isExample, stage: flats.stage, createdAt: flats.createdAt })
    .from(flats)
    .where(eq(flats.userId, userId))
    .orderBy(desc(flats.createdAt));
}

/** The flat if it exists and belongs to the user, otherwise null. */
export async function getOwnedFlat(userId: string, flatId: string): Promise<Flat | null> {
  if (!isUuid(flatId)) return null;
  const [flat] = await db.select().from(flats).where(and(eq(flats.id, flatId), eq(flats.userId, userId))).limit(1);
  return flat ?? null;
}

export function toPhotoDTO(p: Photo): PhotoDTO {
  const isExample = p.contentType === EXAMPLE_CONTENT_TYPE;
  return {
    id: p.id,
    n: p.n,
    room: p.room,
    condition: p.condition,
    note: p.note,
    src: isExample ? null : `/api/photos/${p.id}`,
    isExample,
    sha256: p.sha256,
    takenAt: p.takenAt ? p.takenAt.toISOString() : null,
    takenFrom: p.takenFrom,
    addedAt: p.addedAt.toISOString(),
    capture: p.capture === "live" ? "live" : "upload",
    phase: p.phase === "moveout" ? "moveout" : "movein",
    dayCode: p.dayCode,
    timestampedAt: p.tsaTime ? p.tsaTime.toISOString() : null,
    timestampBy: p.tsaAuthority,
  };
}

export function toChargeDTO(c: Charge): ChargeDTO {
  return {
    id: c.id,
    item: c.item,
    amount: Number(c.amount) || 0,
    aiVerdict: c.aiVerdict,
    decision: c.decision,
    photoNs: c.photoNs,
    reason: c.reason,
    confidence: c.confidence,
    source: c.source === "manual" ? "manual" : "ai",
    aiFlagged: c.aiFlagged,
  };
}

export function toAgreementDTO(a: Agreement): AgreementDTO {
  return {
    files: a.files.map((f, i) => ({ name: f.name, contentType: f.contentType, sizeBytes: f.sizeBytes, href: `/api/flats/${a.flatId}/agreement/files/${i}` })),
    facts: a.facts,
    clauses: a.clauses,
    flags: a.flags,
    pages: a.pages,
    pasted: a.text.length > 0,
    readAt: a.readAt ? a.readAt.toISOString() : null,
    reviewed: a.dismissed,
  };
}

export async function listCharges(flatId: string): Promise<ChargeDTO[]> {
  const rows = await db.select().from(charges).where(eq(charges.flatId, flatId)).orderBy(asc(charges.position), asc(charges.createdAt));
  return rows.map(toChargeDTO);
}

export async function getFlatDTO(userId: string, flatId: string): Promise<FlatDTO | null> {
  const flat = await getOwnedFlat(userId, flatId);
  if (!flat) return null;
  const [allPhotos, agreementRows, chargeList, review, answered, outReview, outAnswered] = await Promise.all([
    db.select().from(photos).where(eq(photos.flatId, flat.id)).orderBy(asc(photos.n)),
    db.select().from(agreements).where(eq(agreements.flatId, flat.id)).limit(1),
    listCharges(flat.id),
    latestReview(flat.id, "movein"),
    latestAnswered(flat.id, "movein"),
    latestReview(flat.id, "moveout"),
    latestAnswered(flat.id, "moveout"),
  ]);
  const photoRows = allPhotos.filter((p) => p.phase !== "moveout");
  const outRows = allPhotos.filter((p) => p.phase === "moveout");
  return {
    id: flat.id,
    stage: flat.stage,
    isExample: flat.isExample,
    address: flat.address,
    ownerName: flat.ownerName,
    tenantName: flat.tenantName,
    moveIn: flat.moveIn,
    keysHandedOver: flat.keysHandedOver,
    monthlyRent: flat.monthlyRent,
    deposit: flat.deposit,
    refundDays: flat.refundDays,
    rooms: flat.rooms,
    evidenceNotes: flat.evidenceNotes,
    deductionsText: flat.deductionsText,
    letter: flat.letter,
    photos: photoRows.map(toPhotoDTO),
    agreement: agreementRows[0] ? toAgreementDTO(agreementRows[0]) : null,
    dayCode: dayCode(flat.id),
    ownerReview: review ? toOwnerReviewDTO(review, photoRows) : null,
    ownerAnswer: answered ? toOwnerReviewDTO(answered, photoRows) : null,
    moveOutPhotos: outRows.map(toPhotoDTO),
    moveOutReview: outReview ? toOwnerReviewDTO(outReview, outRows) : null,
    moveOutAnswer: outAnswered ? toOwnerReviewDTO(outAnswered, outRows) : null,
    charges: chargeList,
    analyzedAt: flat.analyzedAt ? flat.analyzedAt.toISOString() : null,
  };
}
