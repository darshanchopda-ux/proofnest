import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Phone sign-in has its own secret, so rotating the session-cookie secret doesn't lock anyone out and a leak of
 * that secret doesn't open every phone account. Accounts made before it existed are moved over on their next sign-in.
 */
function baseSecret(): string {
  const base = process.env.PHONE_LOGIN_SECRET || process.env.NEON_AUTH_COOKIE_SECRET;
  if (!base) throw new Error("No server secret configured for phone sign-in.");
  return base;
}

function secret(label: string, base = baseSecret()): string {
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
export function phoneAccount(phone: string): { email: string; password: string; legacy: string[] } {
  const derive = (base: string) => createHmac("sha256", secret("phone-password", base)).update(phone).digest("base64url");
  // Passwords made with older secrets, tried once and then replaced (see verifyWhatsAppCode).
  const older = [process.env.PHONE_LOGIN_SECRET_PREVIOUS, process.env.PHONE_LOGIN_SECRET ? process.env.NEON_AUTH_COOKIE_SECRET : undefined];
  const password = derive(baseSecret());
  return {
    email: `wa${phone.replace(/\D/g, "")}@phone.proofnest.app`,
    password,
    legacy: [...new Set(older.filter((b): b is string => !!b).map(derive))].filter((p) => p !== password),
  };
}
