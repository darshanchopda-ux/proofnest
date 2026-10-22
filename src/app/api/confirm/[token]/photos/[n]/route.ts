import { get } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { photos } from "@/db/schema";
import { EXAMPLE_CONTENT_TYPE } from "@/lib/flats";
import { reviewByToken } from "@/lib/owner-review";
import { photoResponse } from "@/lib/photo-response";

/** Streams one photo of a shared move-in record to whoever holds its link, and only photos that record includes. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string; n: string }> }) {
  const { token, n } = await params;
  const found = await reviewByToken(token);
  const shown = found?.review.photos.find((p) => String(p.n) === n);
  if (!found || !shown) return new Response("Not found", { status: 404 });

  const [row] = await db
    .select({ pathname: photos.blobPathname, contentType: photos.contentType })
    .from(photos)
    .where(and(eq(photos.id, shown.id), eq(photos.flatId, found.flat.id)))
    .limit(1);
  if (!row || row.contentType === EXAMPLE_CONTENT_TYPE || !row.pathname) return new Response("Not found", { status: 404 });
  const blob = await get(row.pathname, { access: "private" });
  if (!blob || blob.statusCode !== 200) return new Response("Not found", { status: 404 });

  return photoResponse(blob.stream, blob.blob.contentType || row.contentType, new URL(request.url).searchParams.get("w"), {
    "Cache-Control": "private, max-age=3600",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex",
    "X-Content-Type-Options": "nosniff",
  });
}
