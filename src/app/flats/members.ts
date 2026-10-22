"use server";

import { randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { flatInvites, flatMembers } from "@/db/schema";
import { isUuid, requireUser } from "@/lib/dal";
import { getOwnedFlat } from "@/lib/flats";
import { inviteByToken } from "@/lib/invites";
import type { MemberDTO } from "@/lib/types";
import type { Result } from "./actions";

const NOT_FOUND = { ok: false as const, error: "That flat wasn't found in your account." };

/** Makes a one-time link a flatmate opens to share this flat's record. Only the tenant who added the flat can invite. */
export async function createFlatInvite(flatId: string): Promise<Result<string>> {
  const user = await requireUser();
  const flat = await getOwnedFlat(user.id, flatId);
  if (!flat) return NOT_FOUND;
  if (flat.userId !== user.id) return { ok: false, error: "Ask the flatmate who added this flat to send the invite." };
  const [members] = await db.select({ n: sql<number>`count(*)::int` }).from(flatMembers).where(eq(flatMembers.flatId, flat.id));
  if ((members?.n ?? 0) >= 8) return { ok: false, error: "That's the most flatmates one flat can have." };
  const token = randomBytes(18).toString("base64url");
  await db.insert(flatInvites).values({ flatId: flat.id, token, createdBy: user.id });
  return { ok: true, data: token };
}

/** Joins the flat behind an invite link as a flatmate, using the link up so nobody else can. */
export async function joinFlat(token: string, name: string): Promise<Result> {
  const user = await requireUser(`/join/${token}`);
  const invite = await inviteByToken(token);
  if (!invite) return { ok: false, error: "This invite has been used or has expired. Ask your flatmate for a new one." };
  if (invite.ownerId === user.id) redirect(`/flats/${invite.flatId}`);
  const clean = String(name ?? "").trim().slice(0, 80);
  if (clean.length < 2) return { ok: false, error: "Type your name so your flatmates know who joined." };
  const [used] = await db
    .update(flatInvites)
    .set({ usedAt: new Date() })
    .where(and(eq(flatInvites.id, invite.id), isNull(flatInvites.usedAt)))
    .returning({ id: flatInvites.id });
  if (!used) return { ok: false, error: "This invite has just been used. Ask your flatmate for a new one." };
  await db.insert(flatMembers).values({ flatId: invite.flatId, userId: user.id, name: clean }).onConflictDoNothing();
  redirect(`/flats/${invite.flatId}`);
}

/** Removes a flatmate. The tenant who added the flat can remove anyone; a flatmate can remove only themselves (leave). */
export async function removeMember(flatId: string, memberId: string): Promise<Result> {
  const user = await requireUser();
  const flat = await getOwnedFlat(user.id, flatId);
  if (!flat || !isUuid(memberId)) return NOT_FOUND;
  const mine = flat.userId === user.id;
  const gone = await db
    .delete(flatMembers)
    .where(and(eq(flatMembers.id, memberId), eq(flatMembers.flatId, flat.id), ...(mine ? [] : [eq(flatMembers.userId, user.id)])))
    .returning({ id: flatMembers.id });
  if (!gone.length) return { ok: false, error: "You can only remove yourself from this flat." };
  return { ok: true, data: null };
}

/** Sets a flatmate's part of the deposit (in rupees), or clears it. Anyone on the flat can, since flatmates settle it together. */
export async function setMemberShare(flatId: string, memberId: string, share: string): Promise<Result<MemberDTO["depositShare"]>> {
  const user = await requireUser();
  const flat = await getOwnedFlat(user.id, flatId);
  if (!flat || !isUuid(memberId)) return NOT_FOUND;
  const raw = String(share ?? "").replace(/[₹,\s]/g, "");
  const n = raw === "" ? null : Number(raw);
  if (n != null && (!Number.isFinite(n) || n < 0 || n >= 1e10)) return { ok: false, error: "Enter the share in rupees." };
  await db.update(flatMembers).set({ depositShare: n == null ? null : n.toFixed(2) }).where(and(eq(flatMembers.id, memberId), eq(flatMembers.flatId, flat.id)));
  return { ok: true, data: n };
}
