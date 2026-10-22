"use server";

import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { agreements, charges, flats, ownerReviews, photos } from "@/db/schema";
import { removeBlobs, removeFolder } from "@/lib/blobs";
import { isUuid, requireUser } from "@/lib/dal";
import { EXAMPLE_CONTENT_TYPE, getOwnedFlat, toChargeDTO, toPhotoDTO } from "@/lib/flats";
import { isStale, latestReview, newReviewToken, recordHash, snapshotPhotos, toOwnerReviewDTO } from "@/lib/owner-review";
import type { ChargeDTO, Condition, Decision, FlatPatch, NewFlatInput, OwnerReviewDTO, PhotoDTO } from "@/lib/types";

export type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

const NOT_FOUND: Result<never> = { ok: false, error: "That flat wasn't found in your account." };

function clean(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}
function isoDay(value: unknown): string | null {
  const v = String(value ?? "");
  // Real calendar dates only: Postgres rejects "2024-02-30", which would make the whole save fail.
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v + "T00:00:00Z").toISOString().startsWith(v) ? v : null;
}
function rupees(value: unknown): string | null {
  const raw = String(value ?? "").replace(/[₹,\s]/g, "");
  if (!raw) return null;
  // A plain number first (so "1e5" is 100000, as the number field means); otherwise keep just the digits ("Rs. 30000").
  const n = Number.isFinite(Number(raw)) ? Number(raw) : Number(raw.replace(/[^0-9.]/g, "") || NaN);
  return Number.isFinite(n) && n >= 0 && n < 1e10 ? n.toFixed(2) : null;
}
function dayCount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 && n <= 365 ? n : null;
}

export async function createFlat(input: NewFlatInput): Promise<Result> {
  const user = await requireUser("/flats/new");
  const address = clean(input.address, 200);
  if (!address) return { ok: false, error: "Add the flat's address to continue." };
  const stage = input.stage === "moveout" ? "moveout" : "movein";
  const [row] = await db
    .insert(flats)
    .values({
      userId: user.id,
      stage,
      address,
      ownerName: clean(input.ownerName, 120),
      moveIn: isoDay(input.moveIn),
      keysHandedOver: stage === "moveout" ? isoDay(input.keysHandedOver) : null,
      monthlyRent: rupees(input.monthlyRent),
      deposit: rupees(input.deposit),
      refundDays: dayCount(input.refundDays),
    })
    .returning({ id: flats.id });
  redirect(`/flats/${row.id}?step=${stage === "moveout" ? "check" : "record"}`);
}

export async function createExampleFlat(): Promise<void> {
  const user = await requireUser("/");
  const [row] = await db
    .insert(flats)
    .values({
      userId: user.id,
      stage: "moveout",
      isExample: true,
      address: "Flat 302, Sunrise Apartments, HSR Layout, Bengaluru",
      ownerName: "Mr. R. Sharma",
      moveIn: "2024-03-01",
      keysHandedOver: "2026-09-30",
      monthlyRent: "30000.00",
      deposit: "150000.00",
      refundDays: 0,
      nextPhotoN: 5,
      evidenceNotes:
        '2 Mar 2024, owner on WhatsApp: "Kitchen tile crack is old, don\'t worry about it."\n' +
        "Rent agreement clause 9: tenant pays for damage beyond normal wear and tear. No fixed painting charge is mentioned.\n" +
        "Lived there 2 years 7 months. Electricity bill for September (₹1,850) is still unpaid.",
      deductionsText:
        "Owner's WhatsApp, 2 Oct 2026:\nPainting charges - ₹18,000\nDeep cleaning - ₹4,500\nKitchen tile repair - ₹6,000\n" +
        "Wardrobe hinge repair - ₹2,000\nElectricity bill (Sept) - ₹1,850\nTotal deduction ₹32,350. Will return ₹1,17,650.",
    })
    .returning({ id: flats.id });

  const example = (n: number, room: string, condition: Condition, note: string, minute: number) => ({
    flatId: row.id,
    n,
    room,
    condition,
    note,
    blobPathname: "",
    contentType: EXAMPLE_CONTENT_TYPE,
    sizeBytes: 0,
    takenAt: new Date(`2024-03-01T10:${String(minute).padStart(2, "0")}:00+05:30`),
    takenFrom: "camera",
  });
  await db.insert(photos).values([
    example(1, "Kitchen", "damaged", "Two cracked wall tiles next to the sink", 2),
    example(2, "Bedroom", "worn", "Wardrobe door hinge loose, wall paint patchy", 7),
    example(3, "Hall", "worn", "Wall paint faded with old marks near the switchboard", 11),
    example(4, "Bathroom", "good", "Tap, shower and geyser working", 14),
  ]);
  await db.insert(agreements).values({
    flatId: row.id,
    facts: {
      owner: "Mr. R. Sharma",
      address: "Flat 302, Sunrise Apartments, HSR Layout, Bengaluru",
      agreementDate: "2024-02-25",
      start: "2024-03-01",
      rent: 30000,
      deposit: 150000,
      maintenance: "Included in rent",
      lockIn: "6 months",
      notice: "1 month",
      refundDays: 0,
    },
    clauses: [
      {
        topic: "Deposit refund",
        clause: "4",
        quote: "The security deposit shall be refunded to the Licensee at the time of vacating the premises, after deducting arrears of rent and utility bills, if any.",
        plain: "The deposit is due the day you hand over the keys, minus only unpaid rent and bills.",
      },
      {
        topic: "Repairs and maintenance",
        clause: "9",
        quote: "The Licensee shall bear the cost of repairing any damage caused by the Licensee, normal wear and tear excepted.",
        plain: "You pay only for damage you caused, not for normal wear and tear.",
      },
      { topic: "Painting", clause: "", quote: "", plain: "The agreement does not mention any painting charge." },
      { topic: "Notice period", clause: "12", quote: "Either party may terminate this agreement by giving one month's notice in writing.", plain: "One month's written notice from either side." },
    ],
    pages: 6,
    readAt: new Date(),
    dismissed: true,
  });
  redirect(`/flats/${row.id}?step=record`);
}

export async function updateFlat(flatId: string, patch: FlatPatch): Promise<Result> {
  const user = await requireUser();
  const flat = await getOwnedFlat(user.id, flatId);
  if (!flat) return NOT_FOUND;

  const values: Partial<typeof flats.$inferInsert> = { updatedAt: new Date() };
  if ("address" in patch) {
    const address = clean(patch.address, 200);
    if (!address) return { ok: false, error: "The address can't be empty." };
    values.address = address;
  }
  if ("ownerName" in patch) values.ownerName = clean(patch.ownerName, 120);
  if ("tenantName" in patch) values.tenantName = clean(patch.tenantName, 120);
  if ("moveIn" in patch) values.moveIn = isoDay(patch.moveIn);
  if ("keysHandedOver" in patch) {
    values.keysHandedOver = isoDay(patch.keysHandedOver);
    if (values.keysHandedOver) values.stage = "moveout";
    else {
      // Clearing the handover date undoes "moving out", unless move-out work has already started.
      const deductions = "deductionsText" in patch ? clean(patch.deductionsText, 8000) : flat.deductionsText;
      const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(charges).where(eq(charges.flatId, flat.id));
      if (!deductions && !row?.n) values.stage = "movein";
    }
  }
  if ("monthlyRent" in patch) values.monthlyRent = rupees(patch.monthlyRent);
  if ("deposit" in patch) values.deposit = rupees(patch.deposit);
  if ("refundDays" in patch) values.refundDays = dayCount(patch.refundDays);
  if ("evidenceNotes" in patch) values.evidenceNotes = clean(patch.evidenceNotes, 8000);
  if ("deductionsText" in patch) {
    // The check sends at most 8,000 characters to the AI, so don't keep more than it reads.
    values.deductionsText = clean(patch.deductionsText, 8000);
    if (values.deductionsText) values.stage = "moveout";
  }
  if ("letter" in patch) values.letter = String(patch.letter ?? "").slice(0, 20000);

  await db.update(flats).set(values).where(and(eq(flats.id, flat.id), eq(flats.userId, user.id)));
  return { ok: true, data: null };
}

export async function addRoom(flatId: string, name: string): Promise<Result<string[]>> {
  const user = await requireUser();
  const flat = await getOwnedFlat(user.id, flatId);
  if (!flat) return NOT_FOUND;
  const room = clean(name, 40).replace(/\s+/g, " ");
  if (!room) return { ok: false, error: "Give the room a name." };
  if (flat.rooms.some((r) => r.toLowerCase() === room.toLowerCase())) return { ok: false, error: `${room} is already on the list.` };
  if (flat.rooms.length >= 20) return { ok: false, error: "That's the most rooms one flat can have." };
  const rooms = [...flat.rooms, room];
  await db.update(flats).set({ rooms, updatedAt: new Date() }).where(eq(flats.id, flat.id));
  return { ok: true, data: rooms };
}

export async function removeRoom(flatId: string, name: string): Promise<Result<string[]>> {
  const user = await requireUser();
  const flat = await getOwnedFlat(user.id, flatId);
  if (!flat) return NOT_FOUND;
  const [inUse] = await db
    .select({ id: photos.id })
    .from(photos)
    .where(and(eq(photos.flatId, flat.id), eq(photos.room, name)))
    .limit(1);
  if (inUse) return { ok: false, error: "Delete this room's photos before removing it." };
  const rooms = flat.rooms.filter((r) => r !== name);
  await db.update(flats).set({ rooms, updatedAt: new Date() }).where(eq(flats.id, flat.id));
  return { ok: true, data: rooms };
}

export type RecordPhotoInput = {
  pathname: string;
  contentType: string;
  sizeBytes: number;
  room: string;
  sha256: string;
  takenAt: number | null;
  takenFrom: "camera" | "file";
};

/** Saves a photo that the browser has already uploaded to Blob storage under flats/<flatId>/. */
export async function recordPhoto(flatId: string, input: RecordPhotoInput): Promise<Result<PhotoDTO>> {
  const user = await requireUser();
  const flat = await getOwnedFlat(user.id, flatId);
  if (!flat) return NOT_FOUND;

  const pathname = String(input.pathname ?? "");
  if (!pathname.startsWith(`flats/${flat.id}/photos/`) || pathname.includes("..")) return { ok: false, error: "That upload doesn't belong to this flat." };
  const [existing] = await db.select({ id: photos.id }).from(photos).where(and(eq(photos.flatId, flat.id), eq(photos.blobPathname, pathname))).limit(1);
  if (existing) return { ok: false, error: "That photo is already in your record." };
  if (!/^image\//.test(String(input.contentType))) return { ok: false, error: "Only photos can be added to rooms." };
  const room = clean(input.room, 40);
  if (!room) return { ok: false, error: "Pick a room for the photo." };

  // Claim the next P-number atomically so two uploads never share one.
  const [claimed] = await db
    .update(flats)
    .set({
      nextPhotoN: sql`${flats.nextPhotoN} + 1`,
      rooms: flat.rooms.includes(room) ? flat.rooms : [...flat.rooms, room],
      updatedAt: new Date(),
    })
    .where(and(eq(flats.id, flat.id), eq(flats.userId, user.id)))
    .returning({ next: flats.nextPhotoN });

  // Only plausible capture times: cameras without a clock report the year 0, and a bad value would throw below.
  const takenMs = typeof input.takenAt === "number" ? input.takenAt : NaN;
  const takenAt = Number.isFinite(takenMs) && takenMs >= Date.UTC(2000, 0, 1) && takenMs <= Date.now() + 86_400_000 ? new Date(takenMs) : null;
  const [photo] = await db
    .insert(photos)
    .values({
      flatId: flat.id,
      n: claimed.next - 1,
      room,
      blobPathname: pathname,
      contentType: String(input.contentType).slice(0, 60),
      sizeBytes: Math.max(0, Math.round(Number(input.sizeBytes) || 0)),
      sha256: /^[0-9a-f]{64}$/.test(input.sha256) ? input.sha256 : "",
      takenAt,
      takenFrom: takenAt && input.takenFrom === "camera" ? "camera" : "file",
    })
    .returning();
  return { ok: true, data: toPhotoDTO(photo) };
}

export async function updatePhoto(flatId: string, photoId: string, patch: { condition?: Condition; note?: string }): Promise<Result> {
  const user = await requireUser();
  const flat = await getOwnedFlat(user.id, flatId);
  if (!flat || !isUuid(photoId)) return NOT_FOUND;
  const values: Partial<typeof photos.$inferInsert> = {};
  if (patch.condition && ["good", "worn", "damaged"].includes(patch.condition)) values.condition = patch.condition;
  if (typeof patch.note === "string") values.note = clean(patch.note, 200);
  if (!Object.keys(values).length) return { ok: true, data: null };
  await db.update(photos).set(values).where(and(eq(photos.id, photoId), eq(photos.flatId, flat.id)));
  return { ok: true, data: null };
}

export async function deletePhoto(flatId: string, photoId: string): Promise<Result> {
  const user = await requireUser();
  const flat = await getOwnedFlat(user.id, flatId);
  if (!flat || !isUuid(photoId)) return NOT_FOUND;
  // A photo the owner has already answered about stays, so the record they confirmed keeps all its photos.
  const [answered] = await db
    .select({ id: ownerReviews.id })
    .from(ownerReviews)
    .where(and(eq(ownerReviews.flatId, flat.id), isNotNull(ownerReviews.respondedAt), sql`${ownerReviews.photos} @> ${JSON.stringify([{ id: photoId }])}::jsonb`))
    .limit(1);
  if (answered) return { ok: false, error: "Your owner has already answered about this photo, so it stays in your record." };
  const [photo] = await db.delete(photos).where(and(eq(photos.id, photoId), eq(photos.flatId, flat.id))).returning();
  if (photo && photo.contentType !== EXAMPLE_CONTENT_TYPE) await removeBlobs([photo.blobPathname]);
  return { ok: true, data: null };
}

const DECISION_VALUES: Decision[] = ["already_there", "wear_and_tear", "no_receipt", "check", "likely_valid"];

export async function setChargeDecision(flatId: string, chargeId: string, decision: Decision): Promise<Result> {
  const user = await requireUser();
  const flat = await getOwnedFlat(user.id, flatId);
  if (!flat || !isUuid(chargeId)) return NOT_FOUND;
  if (!DECISION_VALUES.includes(decision)) return { ok: false, error: "Pick one of the listed decisions." };
  await db.update(charges).set({ decision }).where(and(eq(charges.id, chargeId), eq(charges.flatId, flat.id)));
  return { ok: true, data: null };
}

export async function addCharge(flatId: string, item: string, amount: number): Promise<Result<ChargeDTO>> {
  const user = await requireUser();
  const flat = await getOwnedFlat(user.id, flatId);
  if (!flat) return NOT_FOUND;
  const name = clean(item, 160);
  if (!name) return { ok: false, error: "Describe the charge, for example Sofa cleaning." };
  const value = Number.isFinite(amount) && amount >= 0 && amount < 1e10 ? amount : 0;
  const [{ position }] = await db
    .select({ position: sql<number>`coalesce(max(${charges.position}), -1)::int + 1` })
    .from(charges)
    .where(eq(charges.flatId, flat.id));
  const [row] = await db
    .insert(charges)
    .values({ flatId: flat.id, position, item: name, amount: value.toFixed(2), decision: "check", source: "manual" })
    .returning();
  await db.update(flats).set({ stage: "moveout", updatedAt: new Date() }).where(eq(flats.id, flat.id));
  return { ok: true, data: toChargeDTO(row) };
}

export async function deleteCharge(flatId: string, chargeId: string): Promise<Result> {
  const user = await requireUser();
  const flat = await getOwnedFlat(user.id, flatId);
  if (!flat || !isUuid(chargeId)) return NOT_FOUND;
  await db.delete(charges).where(and(eq(charges.id, chargeId), eq(charges.flatId, flat.id)));
  return { ok: true, data: null };
}

/**
 * Returns the link for the owner to confirm the move-in record, making one if needed. A link that's still
 * waiting is reused while the photos are unchanged; otherwise a new one is made and an unanswered old one stops working.
 */
export async function getOwnerReviewLink(flatId: string): Promise<Result<OwnerReviewDTO>> {
  const user = await requireUser();
  const flat = await getOwnedFlat(user.id, flatId);
  if (!flat) return NOT_FOUND;
  const rows = await db.select().from(photos).where(eq(photos.flatId, flat.id)).orderBy(asc(photos.n));
  if (!rows.length) return { ok: false, error: "Add your move-in photos first, then ask your owner to confirm them." };

  const current = await latestReview(flat.id);
  if (current && current.status === "pending" && !current.revokedAt && !isStale(current, rows)) {
    return { ok: true, data: toOwnerReviewDTO(current, rows) };
  }
  if (current && current.status === "pending" && !current.revokedAt) {
    await db.update(ownerReviews).set({ revokedAt: new Date() }).where(eq(ownerReviews.id, current.id));
  }
  const snapshot = snapshotPhotos(rows);
  const [row] = await db
    .insert(ownerReviews)
    .values({ flatId: flat.id, token: newReviewToken(), photos: snapshot, recordHash: recordHash(snapshot) })
    .returning();
  return { ok: true, data: toOwnerReviewDTO(row, rows) };
}

/** Deletes the flat's rent agreement and its files. */
export async function removeAgreement(flatId: string): Promise<Result> {
  const user = await requireUser();
  const flat = await getOwnedFlat(user.id, flatId);
  if (!flat) return NOT_FOUND;
  const [row] = await db.delete(agreements).where(eq(agreements.flatId, flat.id)).returning({ files: agreements.files });
  if (row) await removeBlobs(row.files.map((f) => f.pathname));
  return { ok: true, data: null };
}

/** Records that the tenant has applied or set aside the flat details suggested from their agreement. */
export async function markAgreementReviewed(flatId: string): Promise<Result> {
  const user = await requireUser();
  const flat = await getOwnedFlat(user.id, flatId);
  if (!flat) return NOT_FOUND;
  await db.update(agreements).set({ dismissed: true }).where(eq(agreements.flatId, flat.id));
  return { ok: true, data: null };
}

export async function deleteFlat(flatId: string): Promise<Result> {
  const user = await requireUser();
  const flat = await getOwnedFlat(user.id, flatId);
  if (!flat) return NOT_FOUND;
  // Delete the rows first, then every file in the flat's folder, including uploads that were never recorded.
  await db.delete(flats).where(and(eq(flats.id, flat.id), eq(flats.userId, user.id)));
  await removeFolder(`flats/${flat.id}/`);
  redirect("/");
}
