import "server-only";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { flatInvites, flats } from "@/db/schema";

/** Invite links work once, for a week. */
const INVITE_DAYS = 7;

/** The flat an invite link points to, if the link is still unused and less than a week old. */
export async function inviteByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
  const [row] = await db
    .select({ id: flatInvites.id, flatId: flats.id, address: flats.address, tenantName: flats.tenantName, ownerId: flats.userId })
    .from(flatInvites)
    .innerJoin(flats, eq(flatInvites.flatId, flats.id))
    .where(and(eq(flatInvites.token, token), isNull(flatInvites.usedAt), gt(flatInvites.createdAt, sql`now() - make_interval(days => ${INVITE_DAYS})`)))
    .limit(1);
  return row ?? null;
}

