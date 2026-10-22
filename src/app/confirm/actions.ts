"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { ownerReviews } from "@/db/schema";

export type ReviewAnswer = { ok: true; status: "confirmed" | "disputed"; respondedAt: string } | { ok: false; error: string };

/**
 * Records the owner's answer to a move-in record link. Anyone with the link can answer, once:
 * the update only applies while the link is unanswered and active, so a second submit can't overwrite it.
 */
export async function answerOwnerReview(token: string, input: { decision: string; name: string; note: string; role?: string }): Promise<ReviewAnswer> {
  const decision = input.decision === "disputed" ? "disputed" : "confirmed";
  const name = String(input.name ?? "").trim().slice(0, 120);
  const note = String(input.note ?? "").trim().slice(0, 2000);
  const role = ["owner", "agent", "family"].includes(String(input.role)) ? String(input.role) : "";
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return { ok: false, error: "This link isn't valid." };
  if (name.length < 2) return { ok: false, error: "Type your name so the tenant knows who answered." };
  if (decision === "disputed" && note.length < 3) return { ok: false, error: "Say what isn't right, so the tenant can fix or explain it." };

  const [row] = await db
    .update(ownerReviews)
    .set({ status: decision, ownerName: name, ownerRole: role, ownerNote: note, respondedAt: new Date() })
    .where(and(eq(ownerReviews.token, token), eq(ownerReviews.status, "pending"), isNull(ownerReviews.revokedAt)))
    .returning({ status: ownerReviews.status, respondedAt: ownerReviews.respondedAt });
  if (!row || !row.respondedAt || row.status === "pending") {
    return { ok: false, error: "This link has already been answered, or the tenant has sent a newer one." };
  }
  return { ok: true, status: row.status, respondedAt: row.respondedAt.toISOString() };
}
