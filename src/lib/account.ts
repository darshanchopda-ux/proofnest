import "server-only";
import { lt, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { phoneCodes, signIns } from "@/db/schema";

/** How long sign-in history and used or expired WhatsApp codes are kept (see /privacy). */
export const SIGN_IN_DAYS = 90;

/**
 * Deletes sign-in history older than 90 days and WhatsApp codes older than a day (rate limits look back an hour at most).
 * Runs after sign-ins, so nothing extra has to be scheduled.
 */
export async function pruneOldRecords() {
  try {
    await db.delete(phoneCodes).where(lt(phoneCodes.createdAt, sql`now() - interval '1 day'`));
    await db.delete(signIns).where(lt(signIns.createdAt, sql`now() - make_interval(days => ${SIGN_IN_DAYS})`));
  } catch (e) {
    console.error("Couldn't prune old sign-in records", e);
  }
}

/** The phone number behind a WhatsApp account's internal email ("wa919876543210@phone.proofnest.app"), or null. */
export function accountPhoneOf(email: string): string | null {
  const m = /^wa(\d{8,15})@phone\.proofnest\.app$/.exec(email);
  return m ? `+${m[1]}` : null;
}

/** A short, readable device name from the browser's user agent, like "Chrome on Android". */
function deviceName(ua: string): string {
  const browser = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "A browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

/** Notes a successful sign-in, so the account page can show where the account was used. Never blocks signing in. */
export async function recordSignIn(userId: unknown, method: "whatsapp" | "email", phone = "") {
  if (typeof userId !== "string" || !userId) return;
  try {
    const h = await headers();
    await db.insert(signIns).values({
      userId,
      method,
      phone,
      device: deviceName(h.get("user-agent") ?? ""),
      ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 64),
    });
  } catch (e) {
    console.error("Couldn't record a sign-in", e);
  }
}
