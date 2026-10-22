import { NextResponse } from "next/server";
import { updateFlat, updatePhoto } from "@/app/flats/actions";
import type { Condition, FlatPatch } from "@/lib/types";

/**
 * Saves an edit sent while the page was closing (see lib/pending-saves). Body: { patch } for the flat, or
 * { photo: { id, note?, condition? } }. The same server actions check sign-in, ownership and every field.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { patch?: FlatPatch; photo?: { id?: string; note?: string; condition?: Condition } } | null;
  if (body?.patch && typeof body.patch === "object") return NextResponse.json(await updateFlat(id, body.patch));
  if (body?.photo?.id) {
    const { note, condition } = body.photo;
    return NextResponse.json(await updatePhoto(id, body.photo.id, { ...(note !== undefined && { note }), ...(condition && { condition }) }));
  }
  return NextResponse.json({ ok: false, error: "Nothing to save." }, { status: 400 });
}
