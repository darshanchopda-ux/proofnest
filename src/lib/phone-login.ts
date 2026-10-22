import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

function secret(label: string): string {
  const base = process.env.NEON_AUTH_COOKIE_SECRET || process.env.N8N_WEBHOOK_SECRET;
  if (!base) throw new Error("No server secret configured for phone sign-in.");
  return `${label}:${base}`;
}

/**
 * Turns what someone typed into an E.164 number. Ten digits starting 6–9 are an Indian mobile (+91); a leading 0
 * or 91 is accepted too; anything else must start with + and a country code.
 */
export function normalizePhone(input: string): string | null {
  const raw = String(input ?? "").replace(/[\s\-().]/g, "");
  if (/^[6-9]\d{9}$/.test(raw)) return `+91${raw}`;
  if (/^0[6-9]\d{9}$/.test(raw)) return `+91${raw.slice(1)}`;
  if (/^91[6-9]\d{9}$/.test(raw)) return `+${raw}`;
  if (/^\+[1-9]\d{7,14}$/.test(raw)) return raw;
  return null;
}

/** "+91 98765 43210" for Indian numbers, otherwise the E.164 number as is. */
export function displayPhone(phone: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(phone);
  return m ? `+91 ${m[1]} ${m[2]}` : phone;
}

export function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCode(phone: string, code: string): string {
  return createHmac("sha256", secret("phone-code")).update(`${phone}:${code}`).digest("hex");
}

export function codeMatches(phone: string, code: string, hash: string): boolean {
  const a = Buffer.from(hashCode(phone, code), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The account behind a phone number: an internal email and a password only the server can derive, so the
 * number itself, proven by the WhatsApp code, is the only way in.
 */
export function phoneAccount(phone: string): { email: string; password: string } {
  return {
    email: `wa${phone.replace(/\D/g, "")}@phone.proofnest.app`,
    password: createHmac("sha256", secret("phone-password")).update(phone).digest("base64url"),
  };
}
