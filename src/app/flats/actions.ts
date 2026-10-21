"use server";

import { del } from "@vercel/blob";
import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { agreements, charges, flats, photos } from "@/db/schema";
import { isUuid, requireUser } from "@/lib/dal";
import { EXAMPLE_CONTENT_TYPE, getOwnedFlat, toChargeDTO, toPhotoDTO } from "@/lib/flats";
import type { ChargeDTO, Condition, Decision, FlatPatch, NewFlatInput, PhotoDTO } from "@/lib/types";

export type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

const NOT_FOUND: Result<never> = { ok: false, error: "That flat wasn't found in your account." };

function clean(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}
function isoDay(value: unknown): string | null {
  const v = String(value ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}
function rupees(value: unknown): string | null {
  const v = String(value ?? "").replace(/[^0-9.]/g, "");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n < 1e10 ? n.toFixed(2) : null;
}
function dayCount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 && n <= 365 ? n : null;
}
async function removeBlobs(pathnames: string[]) {
  const real = pathnames.filter(Boolean);
  if (!real.length || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await del(real);
  } catch (e) {
    console.error("Blob delete failed", e);
  }
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
  }
  if ("monthlyRent" in patch) values.monthlyRent = rupees(patch.monthlyRent);
  if ("deposit" in patch) values.deposit = rupees(patch.deposit);
  if ("refundDays" in patch) values.refundDays = dayCount(patch.refundDays);
  if ("evidenceNotes" in patch) values.evidenceNotes = clean(patch.evidenceNotes, 8000);
  if ("deductionsText" in patch) {
    values.deductionsText = clean(patch.deductionsText, 10000);
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
  if (!pathname.startsWith(`flats/${flat.id}/`) || pathname.includes("..")) return { ok: false, error: "That upload doesn't belong to this flat." };
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

  const takenAt = typeof input.takenAt === "number" && Number.isFinite(input.takenAt) ? new Date(input.takenAt) : null;
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
      takenFrom: input.takenFrom === "camera" ? "camera" : "file",
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

export async function deleteFlat(flatId: string): Promise<Result> {
  const user = await requireUser();
  const flat = await getOwnedFlat(user.id, flatId);
  if (!flat) return NOT_FOUND;
  const [photoRows, agreementRows] = await Promise.all([
    db.select({ pathname: photos.blobPathname }).from(photos).where(eq(photos.flatId, flat.id)),
    db.select({ files: agreements.files }).from(agreements).where(eq(agreements.flatId, flat.id)),
  ]);
  await removeBlobs([...photoRows.map((p) => p.pathname), ...agreementRows.flatMap((a) => a.files.map((f) => f.pathname))]);
  await db.delete(flats).where(and(eq(flats.id, flat.id), eq(flats.userId, user.id)));
  redirect("/");
}
