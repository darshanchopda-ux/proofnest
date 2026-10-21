import { get } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agreements } from "@/db/schema";
import { getCurrentUser } from "@/lib/dal";
import { getOwnedFlat } from "@/lib/flats";

/** Streams one of a flat's private agreement files to its owner. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to view this file.", { status: 401 });
  const flat = await getOwnedFlat(user.id, id);
  if (!flat || !/^\d{1,2}$/.test(n)) return new Response("Not found", { status: 404 });

  const [ag] = await db.select({ files: agreements.files }).from(agreements).where(eq(agreements.flatId, flat.id)).limit(1);
  const file = ag?.files[Number(n)];
  if (!file) return new Response("Not found", { status: 404 });
  const blob = await get(file.pathname, { access: "private" });
  if (!blob || blob.statusCode !== 200) return new Response("Not found", { status: 404 });

  return new Response(blob.stream, {
    headers: {
      "Content-Type": blob.blob.contentType || file.contentType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      // The same URL serves a different file after the agreement is replaced.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
