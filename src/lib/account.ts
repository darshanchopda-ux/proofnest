import "server-only";
import { headers } from "next/headers";
import { db } from "@/db";
import { signIns } from "@/db/schema";

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
