import "server-only";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { phoneCodes } from "@/db/schema";
import { codeMatches } from "@/lib/phone-login";

export const CODE_MINUTES = 5;
const MAX_TRIES = 5;

/**
 * Checks a WhatsApp code for a number and uses it up. Returns an error to show, or "" when the code was right.
 * Each code works once, for 5 minutes, and is cancelled after 5 wrong tries.
 */
export async function checkPhoneCode(phone: string, code: string): Promise<string> {
  const [row] = await db
    .select()
    .from(phoneCodes)
    .where(and(eq(phoneCodes.phone, phone), isNull(phoneCodes.usedAt), gt(phoneCodes.expiresAt, new Date())))
    .orderBy(desc(phoneCodes.createdAt))
    .limit(1);
  if (!row) return "That code has expired. Send a new one.";
  if (row.attempts >= MAX_TRIES) return "Too many wrong tries. Send a new code.";
  if (!codeMatches(phone, code, row.codeHash)) {
    await db.update(phoneCodes).set({ attempts: sql`${phoneCodes.attempts} + 1` }).where(eq(phoneCodes.id, row.id));
    const left = MAX_TRIES - row.attempts - 1;
    return left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong tries. Send a new code.";
  }
  // Mark it used first, and only if nobody else just did, so a code can't sign in twice.
  const [claimed] = await db
    .update(phoneCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(phoneCodes.id, row.id), isNull(phoneCodes.usedAt)))
    .returning({ id: phoneCodes.id });
  if (!claimed) return "That code has already been used. Send a new one.";
  return "";
}

