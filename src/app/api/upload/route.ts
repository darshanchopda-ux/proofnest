import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { getOwnedFlat } from "@/lib/flats";

const PHOTO_TYPES = ["image/jpeg"];
// Agreements can be photos of the pages in any common format, or a PDF.
const PAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const AGREEMENT_TYPES = ["application/pdf", ...PAGE_TYPES];

/** Issues short-lived tokens so the browser can upload a flat's files straight to private Blob storage. */
export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Photo storage isn't connected yet." }, { status: 503 });
  }
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "That upload request couldn't be read." }, { status: 400 });
  }
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await getCurrentUser();
        if (!user) throw new Error("Sign in to upload photos.");
        const { flatId, kind } = JSON.parse(clientPayload ?? "{}") as { flatId?: string; kind?: string };
        const flat = flatId ? await getOwnedFlat(user.id, flatId) : null;
        if (!flat) throw new Error("That flat wasn't found in your account.");
        const folder = kind === "agreement" ? `flats/${flat.id}/agreement/` : `flats/${flat.id}/photos/`;
        if (!pathname.startsWith(folder) || pathname.includes("..")) throw new Error("Uploads must go into this flat's folder.");
        return {
          allowedContentTypes: kind === "agreement" ? AGREEMENT_TYPES : PHOTO_TYPES,
          maximumSizeInBytes: 20 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id, flatId: flat.id }),
        };
      },
    });
    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}
