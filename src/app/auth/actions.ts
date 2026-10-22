"use server";

import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { phoneCodes, phoneLinks } from "@/db/schema";
import { recordSignIn } from "@/lib/account";
import { checkPhoneCode, CODE_MINUTES } from "@/lib/phone-codes";
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

  const { data, error } = await auth.signIn.email({ email, password });
  if (error) return { error: error.message || "That email and password don't match. Try again." };
  await recordSignIn(data?.user?.id, "email");

  redirect(safeNext(formData.get("next")));
}

export async function signUpWithEmail(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!name || !email) return { error: "Enter your name and email." };
  if (password.length < 8) return { error: "Use a password of at least 8 characters." };
  if (!formData.get("consent")) return { error: "Tick the box to agree to the privacy notice." };

  const { data, error } = await auth.signUp.email({ name, email, password });
  if (error) return { error: error.message || "Couldn't create your account. Try again." };
  await recordSignIn(data?.user?.id, "email");

  redirect(safeNext(formData.get("next")));
}


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
 * A backup number signs in to the account it was added to; a number its owner switched off can't sign in.
 */
export async function verifyWhatsAppCode(phoneInput: string, codeInput: string, next: string): Promise<{ ok: false; error: string }> {
  const phone = normalizePhone(phoneInput);
  const code = String(codeInput ?? "").replace(/\D/g, "");
  if (!phone || code.length !== 6) return { ok: false, error: "Enter the 6-digit code from WhatsApp." };

  const [link] = await db.select().from(phoneLinks).where(eq(phoneLinks.phone, phone)).limit(1);
  // Checked before the code, so a recycled number can't even try: Indian operators reissue numbers after about 90 days.
  if (link?.disabledAt) {
    return { ok: false, error: "This number was switched off for ProofNest sign-in by its account holder. Sign in with their backup number or email." };
  }
  const err = await checkPhoneCode(phone, code);
  if (err) return { ok: false, error: err };

  const accountPhone = link?.accountPhone ?? phone;
  const { email, password } = phoneAccount(accountPhone);
  const signedIn = await auth.signIn.email({ email, password });
  let userId = signedIn.data?.user?.id;
  if (signedIn.error) {
    const created = await auth.signUp.email({ name: displayPhone(accountPhone), email, password });
    if (created.error) return { ok: false, error: "Couldn't sign you in. Try again in a minute." };
    userId = created.data?.user?.id;
  }
  await recordSignIn(userId, "whatsapp", phone);
  redirect(safeNext(next));
}

export async function signOut() {
  await auth.signOut();
  redirect("/");
}
