import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { flats, photos } from "@/db/schema";
import { getCurrentUser, isUuid } from "@/lib/dal";

/** Downloads a photo's RFC 3161 timestamp reply (.tsr) for its owner, to check with `openssl ts -verify`. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to download this.", { status: 401 });
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const [row] = await db
    .select({ n: photos.n, token: photos.tsaToken })
    .from(photos)
    .innerJoin(flats, eq(photos.flatId, flats.id))
    .where(and(eq(photos.id, id), eq(flats.userId, user.id)))
    .limit(1);
  if (!row?.token) return new Response("This photo hasn't been timestamped yet.", { status: 404 });
  return new Response(new Uint8Array(Buffer.from(row.token, "base64")), {
    headers: {
      "Content-Type": "application/timestamp-reply",
      "Content-Disposition": `attachment; filename="P${row.n}.tsr"`,
      "Cache-Control": "private, no-store",
    },
  });
}
