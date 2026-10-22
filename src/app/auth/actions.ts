"use server";

import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { phoneCodes } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { codeMatches, displayPhone, hashCode, newCode, normalizePhone, phoneAccount } from "@/lib/phone-login";
import { sendWhatsAppCode, whatsappConfigured } from "@/lib/whatsapp";

export type AuthFormState = { error: string } | null;

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  // Only allow same-site paths so the form can't be used as an open redirect. Parsing it the way the browser
  // will catches tricks like "/\\evil.example" or a tab inside "//", which a prefix check lets through.
  const base = "http://proofnest.invalid";
  try {
    const url = new URL(next, base);
    return next.startsWith("/") && url.origin === base ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}

export async function signInWithEmail(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const { error } = await auth.signIn.email({ email, password });
  if (error) return { error: error.message || "That email and password don't match. Try again." };

  redirect(safeNext(formData.get("next")));
}

export async function signUpWithEmail(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!name || !email) return { error: "Enter your name and email." };
  if (password.length < 8) return { error: "Use a password of at least 8 characters." };

  const { error } = await auth.signUp.email({ name, email, password });
  if (error) return { error: error.message || "Couldn't create your account. Try again." };

  redirect(safeNext(formData.get("next")));
}

const CODE_MINUTES = 5;
const MAX_TRIES = 5;

export type CodeRequest = { ok: true; phone: string; display: string; note?: string } | { ok: false; error: string };

/** Sends a 6-digit sign-in code on WhatsApp to the number typed in. Rate-limited per number and per connection. */
export async function requestWhatsAppCode(input: string): Promise<CodeRequest> {
  const phone = normalizePhone(input);
  if (!phone) return { ok: false, error: "Enter a 10-digit mobile number, or a number with its country code like +44…" };
  const devLog = !whatsappConfigured() && process.env.NODE_ENV === "development";
  if (!whatsappConfigured() && !devLog) return { ok: false, error: "Sign-in with WhatsApp isn't set up yet. Use email for now." };

  const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim();
  const [perPhone] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(phoneCodes)
    .where(and(eq(phoneCodes.phone, phone), gt(phoneCodes.createdAt, sql`now() - interval '15 minutes'`)));
  if ((perPhone?.n ?? 0) >= 3) return { ok: false, error: "We've sent a few codes to this number already. Wait 15 minutes, then try again." };
  if (ip) {
    const [perIp] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(phoneCodes)
      .where(and(eq(phoneCodes.ip, ip), gt(phoneCodes.createdAt, sql`now() - interval '1 hour'`)));
    if ((perIp?.n ?? 0) >= 20) return { ok: false, error: "Too many codes from this connection. Try again in an hour." };
  }

  const code = newCode();
  await db.insert(phoneCodes).values({ phone, codeHash: hashCode(phone, code), ip, expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000) });
  if (devLog) {
    // Local development without WhatsApp credentials: the code goes to the server log instead.
    console.log(`[dev] WhatsApp sign-in code for ${phone}: ${code}`);
    return { ok: true, phone, display: displayPhone(phone), note: "WhatsApp isn't configured here, so the code is in the dev server's log." };
  }
  const sent = await sendWhatsAppCode(phone, code);
  if (!sent.ok) return sent;
  return { ok: true, phone, display: displayPhone(phone) };
}

/**
 * Checks the code and signs the person in to the account for that number, creating it the first time.
 * Each code works once, for 5 minutes, and is cancelled after 5 wrong tries.
 */
export async function verifyWhatsAppCode(phoneInput: string, codeInput: string, next: string): Promise<{ ok: false; error: string }> {
  const phone = normalizePhone(phoneInput);
  const code = String(codeInput ?? "").replace(/\D/g, "");
  if (!phone || code.length !== 6) return { ok: false, error: "Enter the 6-digit code from WhatsApp." };

  const [row] = await db
    .select()
    .from(phoneCodes)
    .where(and(eq(phoneCodes.phone, phone), isNull(phoneCodes.usedAt), gt(phoneCodes.expiresAt, new Date())))
    .orderBy(desc(phoneCodes.createdAt))
    .limit(1);
  if (!row) return { ok: false, error: "That code has expired. Send a new one." };
  if (row.attempts >= MAX_TRIES) return { ok: false, error: "Too many wrong tries. Send a new code." };
  if (!codeMatches(phone, code, row.codeHash)) {
    await db.update(phoneCodes).set({ attempts: sql`${phoneCodes.attempts} + 1` }).where(eq(phoneCodes.id, row.id));
    const left = MAX_TRIES - row.attempts - 1;
    return { ok: false, error: left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong tries. Send a new code." };
  }
  // Mark it used first, and only if nobody else just did, so a code can't sign in twice.
  const [claimed] = await db
    .update(phoneCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(phoneCodes.id, row.id), isNull(phoneCodes.usedAt)))
    .returning({ id: phoneCodes.id });
  if (!claimed) return { ok: false, error: "That code has already been used. Send a new one." };

  const { email, password } = phoneAccount(phone);
  const signedIn = await auth.signIn.email({ email, password });
  if (signedIn.error) {
    const created = await auth.signUp.email({ name: displayPhone(phone), email, password });
    if (created.error) return { ok: false, error: "Couldn't sign you in. Try again in a minute." };
  }
  redirect(safeNext(next));
}

export async function signOut() {
  await auth.signOut();
  redirect("/");
}
