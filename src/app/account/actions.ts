"use server";

import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { flatMembers, flats, phoneCodes, phoneLinks, signIns } from "@/db/schema";
import { accountPhoneOf } from "@/lib/account";
import { auth } from "@/lib/auth/server";
import { removeFolder } from "@/lib/blobs";
import { requireUser } from "@/lib/dal";
import { checkPhoneCode } from "@/lib/phone-codes";
import { normalizePhone, phoneAccount } from "@/lib/phone-login";

type Done = { ok: true } | { ok: false; error: string };

async function phoneUser() {
  const user = await requireUser("/account");
  return { user, mine: accountPhoneOf(user.email) };
}

/** Adds a second WhatsApp number that signs in to this account, after checking the code sent to it. */
export async function addBackupPhone(input: string, codeInput: string): Promise<Done> {
  const { mine } = await phoneUser();
  if (!mine) return { ok: false, error: "Backup numbers are for accounts that sign in with WhatsApp. You can always sign in with your email." };
  const phone = normalizePhone(input);
  const code = String(codeInput ?? "").replace(/\D/g, "");
  if (!phone || code.length !== 6) return { ok: false, error: "Enter the number and the 6-digit code from WhatsApp." };
  if (phone === mine) return { ok: false, error: "That's the number you sign in with already." };
  const [existing] = await db.select().from(phoneLinks).where(eq(phoneLinks.phone, phone)).limit(1);
  if (existing && existing.accountPhone !== mine) return { ok: false, error: "That number is already linked to another ProofNest account." };
  const [count] = await db.select({ n: sql<number>`count(*)::int` }).from(phoneLinks).where(and(eq(phoneLinks.accountPhone, mine), ne(phoneLinks.phone, mine)));
  if (!existing && (count?.n ?? 0) >= 2) return { ok: false, error: "You can add up to two backup numbers. Remove one first." };
  const err = await checkPhoneCode(phone, code);
  if (err) return { ok: false, error: err };
  await db
    .insert(phoneLinks)
    .values({ phone, accountPhone: mine })
    .onConflictDoUpdate({ target: phoneLinks.phone, set: { accountPhone: mine, disabledAt: null } });
  return { ok: true };
}

export async function removeBackupPhone(phone: string): Promise<Done> {
  const { mine } = await phoneUser();
  if (!mine || phone === mine) return { ok: false, error: "That number can't be removed." };
  if (!(await stillWorks(mine, phone))) {
    return { ok: false, error: "This is the only number that can sign in to your account. Add another, or switch your main number back on, first." };
  }
  await db.delete(phoneLinks).where(and(eq(phoneLinks.phone, phone), eq(phoneLinks.accountPhone, mine)));
  return { ok: true };
}

/**
 * Switches off sign-in for a lost or stolen number (it may be reissued to someone else), and signs out every device,
 * including any still signed in on the lost phone. Needs another number that still works.
 */
export async function disablePhone(phone: string): Promise<Done> {
  const { mine } = await phoneUser();
  if (!mine) return { ok: false, error: "Your account signs in with email." };
  const links = await db.select({ phone: phoneLinks.phone }).from(phoneLinks).where(eq(phoneLinks.accountPhone, mine));
  if (phone !== mine && !links.some((l) => l.phone === phone)) return { ok: false, error: "That number isn't on your account." };
  if (!(await stillWorks(mine, phone))) {
    return { ok: false, error: "Add a backup number first, so you can still sign in after switching this one off." };
  }
  await db
    .insert(phoneLinks)
    .values({ phone, accountPhone: mine, disabledAt: new Date() })
    .onConflictDoUpdate({ target: phoneLinks.phone, set: { disabledAt: new Date() } });
  await signOutEverywhere();
  return { ok: true };
}

/** True when some number other than `except` can still sign in to the account (phone accounts have no password). */
async function stillWorks(mine: string, except: string): Promise<boolean> {
  const links = await db.select().from(phoneLinks).where(eq(phoneLinks.accountPhone, mine));
  const numbers = [mine, ...links.filter((l) => l.phone !== mine).map((l) => l.phone)];
  const off = new Set(links.filter((l) => l.disabledAt).map((l) => l.phone));
  return numbers.some((n) => n !== except && !off.has(n));
}

/** Lets a switched-off number sign in again. */
export async function enablePhone(phone: string): Promise<Done> {
  const { mine } = await phoneUser();
  if (!mine) return { ok: false, error: "Your account signs in with email." };
  if (phone === mine) await db.delete(phoneLinks).where(and(eq(phoneLinks.phone, mine), eq(phoneLinks.accountPhone, mine)));
  else await db.update(phoneLinks).set({ disabledAt: null }).where(and(eq(phoneLinks.phone, phone), eq(phoneLinks.accountPhone, mine)));
  return { ok: true };
}

/** Signs out every browser and phone signed in to this account, this one included. */
export async function signOutEverywhere() {
  await requireUser("/account");
  await auth.revokeSessions();
  await auth.signOut();
  redirect("/auth/sign-in?next=/account");
}

/**
 * Deletes the account and everything in it: flats the user added (with every photo and file), their place on
 * flats they joined, numbers, sign-in history, and the sign-in account itself.
 */
export async function deleteAccount(confirm: string, password = ""): Promise<Done> {
  const { user, mine } = await phoneUser();
  if (confirm.trim().toUpperCase() !== "DELETE") return { ok: false, error: "Type DELETE to confirm." };

  // The sign-in account goes first: if it can't be deleted, nothing else is, and the person is told why.
  // Phone accounts use their server-derived password; email accounts need a recent sign-in or their password.
  let removed = await auth.deleteUser({});
  for (const pw of mine ? [phoneAccount(mine).password, ...phoneAccount(mine).legacy] : password ? [password] : []) {
    if (!removed.error) break;
    removed = await auth.deleteUser({ password: pw });
  }
  if (removed.error) {
    console.error("Couldn't delete the sign-in account", user.id, removed.error);
    return {
      ok: false,
      error: mine ? "Couldn't delete your account just now. Sign out, sign in again, then try once more." : "Enter your password to confirm, then try again.",
    };
  }

  const owned = await db.delete(flats).where(eq(flats.userId, user.id)).returning({ id: flats.id });
  for (const f of owned) await removeFolder(`flats/${f.id}/`);
  await db.delete(flatMembers).where(eq(flatMembers.userId, user.id));
  await db.delete(signIns).where(eq(signIns.userId, user.id));
  if (mine) {
    const links = await db.delete(phoneLinks).where(eq(phoneLinks.accountPhone, mine)).returning({ phone: phoneLinks.phone });
    await db.delete(phoneCodes).where(and(inArray(phoneCodes.phone, [mine, ...links.map((l) => l.phone)]), isNull(phoneCodes.usedAt)));
  }
  await auth.signOut().catch(() => null);
  redirect("/?deleted=1");
}
