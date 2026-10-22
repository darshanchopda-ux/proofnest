import "server-only";
import sharp from "sharp";

/** Widths the photo routes resize to: check-step thumbnails, the photo grid, and the PDF and owner page. */
const WIDTHS = [160, 480, 1200];

/**
 * Responds with a stored photo: resized to a JPEG when `?w=` names one of the allowed widths (so grids don't
 * download full-size originals), otherwise the original as it was uploaded.
 */
export async function photoResponse(stream: ReadableStream<Uint8Array>, contentType: string, width: string | null, headers: Record<string, string>) {
  const w = Number(width);
  if (WIDTHS.includes(w)) {
    try {
      const original = Buffer.from(await new Response(stream).arrayBuffer());
      const small = await sharp(original).rotate().resize({ width: w, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
      return new Response(new Uint8Array(small), { headers: { ...headers, "Content-Type": "image/jpeg" } });
    } catch (e) {
      console.error("Couldn't resize photo", e);
      return new Response("Couldn't open this photo", { status: 422 });
    }
  }
  return new Response(stream, { headers: { ...headers, "Content-Type": contentType } });
}
