import { get } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { flats, photos } from "@/db/schema";
import { getCurrentUser, isUuid } from "@/lib/dal";
import { canOpen, EXAMPLE_CONTENT_TYPE } from "@/lib/flats";
import { photoResponse } from "@/lib/photo-response";

/** Streams a private photo to its owner. Photos are never served from a public URL. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to view this photo.", { status: 401 });
  if (!isUuid(id)) return new Response("Not found", { status: 404 });

  const [row] = await db
    .select({ pathname: photos.blobPathname, contentType: photos.contentType })
    .from(photos)
    .innerJoin(flats, eq(photos.flatId, flats.id))
    .where(and(eq(photos.id, id), canOpen(user.id)))
    .limit(1);
  if (!row || row.contentType === EXAMPLE_CONTENT_TYPE || !row.pathname) return new Response("Not found", { status: 404 });

  const blob = await get(row.pathname, { access: "private" });
  if (!blob || blob.statusCode !== 200) return new Response("Not found", { status: 404 });

  return photoResponse(blob.stream, blob.blob.contentType || row.contentType, new URL(request.url).searchParams.get("w"), {
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  });
}
