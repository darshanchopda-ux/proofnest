/** Browser-only helpers for move-in photos: capture time, fingerprint and conversion. */

export const UPLOADABLE = /^image\/(jpeg|png|webp)$/;

/** SHA-256 of the original file, as hex. Empty string if the browser can't compute it. */
export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
}

/** DateTimeOriginal (or DateTime) from a JPEG's EXIF block, as epoch ms. Null when absent. */
export function exifDate(buf: ArrayBuffer): number | null {
  try {
    const v = new DataView(buf);
    const ascii = (o: number, n: number) => {
      let s = "";
      for (let k = 0; k < n && o + k < v.byteLength; k++) {
        const ch = v.getUint8(o + k);
        if (!ch) break;
        s += String.fromCharCode(ch);
      }
      return s;
    };
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null;
    let off = 2;
    while (off + 4 < v.byteLength) {
      const marker = v.getUint16(off);
      if ((marker & 0xff00) !== 0xff00) return null;
      const size = v.getUint16(off + 2);
      if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) {
        const t = off + 10;
        const le = v.getUint16(t) === 0x4949;
        const g16 = (o: number) => v.getUint16(o, le);
        const g32 = (o: number) => v.getUint32(o, le);
        const ifd0 = t + g32(t + 4);
        let exifPtr = 0;
        let dt = "";
        for (let i = 0; i < g16(ifd0); i++) {
          const e = ifd0 + 2 + i * 12;
          const tag = g16(e);
          if (tag === 0x8769) exifPtr = t + g32(e + 8);
          if (tag === 0x0132) dt = ascii(t + g32(e + 8), 19);
        }
        if (exifPtr) {
          for (let j = 0; j < g16(exifPtr); j++) {
            const e2 = exifPtr + 2 + j * 12;
            if (g16(e2) === 0x9003) {
              dt = ascii(t + g32(e2 + 8), 19);
              break;
            }
          }
        }
        const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(dt);
        if (!m || +m[1] < 2000) return null;
        const when = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
        return Number.isFinite(when) && when <= Date.now() + 86_400_000 ? when : null;
      }
      if (marker === 0xffda) return null;
      off += 2 + size;
    }
  } catch {
    // Unreadable EXIF just means we fall back to the file date.
  }
  return null;
}

/** Re-encodes an image as JPEG, scaled so its longest side is at most maxDim. */
export async function toJpeg(blob: Blob, maxDim: number, quality = 0.88): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't convert the photo."))), "image/jpeg", quality),
  );
}

export function safeFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "-").replace(/-+/g, "-").slice(0, 40) || "photo";
  return base.toLowerCase();
}
