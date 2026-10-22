import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { get } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { photos, type Photo } from "@/db/schema";
import { EXAMPLE_CONTENT_TYPE } from "@/lib/flats";

/** Public RFC 3161 timestamp authorities, tried in order. Neither sees the photo, only its SHA-256. */
const AUTHORITIES = [
  { name: "freetsa.org", url: "https://freetsa.org/tsr" },
  { name: "DigiCert", url: "http://timestamp.digicert.com" },
];

/** Builds a DER TimeStampReq for a SHA-256 digest, with a nonce and a request for the authority's certificate. */
function timestampRequest(digest: Buffer, nonce: Buffer): Buffer {
  const sha256 = Buffer.from("300d06096086480165030402010500", "hex"); // AlgorithmIdentifier { sha256, NULL }
  const imprint = Buffer.concat([Buffer.from([0x30, 0x31]), sha256, Buffer.from([0x04, 0x20]), digest]);
  const body = Buffer.concat([Buffer.from([0x02, 0x01, 0x01]), imprint, Buffer.from([0x02, 0x08]), nonce, Buffer.from([0x01, 0x01, 0xff])]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

/** The signed time in a TimeStampResp: the first GeneralizedTime, which is TSTInfo's genTime. */
function genTime(reply: Buffer): Date | null {
  for (let i = 0; i < reply.length - 17; i++) {
    if (reply[i] !== 0x18) continue;
    const s = reply.subarray(i + 2, i + 2 + reply[i + 1]).toString("latin1");
    const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\.\d+)?Z$/.exec(s);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  }
  return null;
}

/**
 * Gets an RFC 3161 timestamp for a SHA-256 hex digest. Returns the authority's signed reply (base64, which
 * `openssl ts -verify` checks) and its signed time, or null if no authority answered with a matching grant.
 */
export async function timestampDigest(hex: string): Promise<{ token: string; time: Date; authority: string } | null> {
  if (!/^[0-9a-f]{64}$/.test(hex)) return null;
  const digest = Buffer.from(hex, "hex");
  for (const tsa of AUTHORITIES) {
    try {
      const nonce = randomBytes(8);
      nonce[0] &= 0x7f; // keep the INTEGER positive
      const res = await fetch(tsa.url, {
        method: "POST",
        headers: { "content-type": "application/timestamp-query" },
        body: new Uint8Array(timestampRequest(digest, nonce)),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const reply = Buffer.from(await res.arrayBuffer());
      // PKIStatusInfo { status 0 = granted } comes first, then the token, which must carry our digest and nonce.
      const granted = reply.subarray(4, 9).equals(Buffer.from("3003020100", "hex")) || reply.subarray(2, 7).equals(Buffer.from("3003020100", "hex"));
      const time = genTime(reply);
      if (granted && time && reply.includes(digest) && reply.includes(nonce)) {
        return { token: reply.toString("base64"), time, authority: tsa.name };
      }
    } catch (e) {
      console.error("Timestamp authority failed", tsa.name, e);
    }
  }
  return null;
}

/** SHA-256 of the file exactly as ProofNest stores it: the copy that would be produced as evidence. */
async function storedHash(pathname: string): Promise<string | null> {
  const blob = await get(pathname, { access: "private" });
  if (!blob || blob.statusCode !== 200) return null;
  return createHash("sha256").update(Buffer.from(await new Response(blob.stream).arrayBuffer())).digest("hex");
}

/** Fingerprints a stored photo from the file itself and timestamps that fingerprint. Safe to run more than once. */
export async function sealPhoto(p: Pick<Photo, "id" | "flatId" | "blobPathname" | "contentType" | "tsaToken">) {
  if (p.tsaToken || p.contentType === EXAMPLE_CONTENT_TYPE || !p.blobPathname) return;
  try {
    const hash = await storedHash(p.blobPathname);
    if (!hash) return;
    const stamp = await timestampDigest(hash);
    await db
      .update(photos)
      .set({ sha256: hash, ...(stamp && { tsaToken: stamp.token, tsaTime: stamp.time, tsaAuthority: stamp.authority }) })
      .where(and(eq(photos.id, p.id), eq(photos.flatId, p.flatId)));
  } catch (e) {
    console.error("Couldn't seal photo", p.id, e);
  }
}

/** Timestamps any of a flat's photos that don't have one yet (for example if both authorities were down). */
export async function sealMissing(flatId: string) {
  const rows = await db
    .select({ id: photos.id, flatId: photos.flatId, blobPathname: photos.blobPathname, contentType: photos.contentType, tsaToken: photos.tsaToken })
    .from(photos)
    .where(and(eq(photos.flatId, flatId), eq(photos.tsaToken, "")));
  for (let i = 0; i < rows.length; i += 4) await Promise.all(rows.slice(i, i + 4).map(sealPhoto));
}

const CODE_ALPHABET = "ACDEFHJKMNPRTUVWXY3479"; // no 0/O, 1/I/L, 2/Z, 5/S, 6/G, 8/B

/** Today's date in India as YYYY-MM-DD. */
export function todayInIndia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/**
 * A 4-character code for one flat on one day in India. It's derived from a server secret, so nobody can know a
 * future day's code in advance, which is what makes it useful in a photo.
 */
export function dayCode(flatId: string, day = todayInIndia()): string {
  const secret = process.env.NEON_AUTH_COOKIE_SECRET || process.env.N8N_WEBHOOK_SECRET || "proofnest";
  const mac = createHmac("sha256", secret).update(`daycode:${flatId}:${day}`).digest();
  return Array.from(mac.subarray(0, 4), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/** True if the code is the flat's code for today, or for yesterday within the first 10 minutes after midnight. */
export function isCurrentDayCode(flatId: string, code: string): boolean {
  if (code === dayCode(flatId)) return true;
  const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return code === dayCode(flatId, tenMinutesAgo);
}
