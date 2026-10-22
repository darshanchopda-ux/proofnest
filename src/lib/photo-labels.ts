import type { PhotoDTO, PhotoPhase } from "./types";

/** Key for the "Adding photo…" placeholders, so move-in and move-out uploads of one room are counted apart. */
export function pendingKey(phase: PhotoPhase, room: string): string {
  return phase === "moveout" ? `moveout:${room}` : room;
}

/** True for gallery photos added as earlier evidence: kept, but not taken with ProofNest's camera. */
export function isEarlier(p: Pick<PhotoDTO, "capture" | "isExample">): boolean {
  return p.capture !== "live" && !p.isExample;
}

/** How a photo was captured and sealed, in one line for cards, the lightbox and the record. */
export function proofLine(p: PhotoDTO): string {
  return [
    p.capture === "live" ? `Taken live · code ${p.dayCode}` : "Earlier photo from the gallery · not verified",
    p.timestampedAt ? `timestamped by ${p.timestampBy}` : p.isExample ? "" : "timestamp pending",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Whole days from move-in to the first live photo, when the record was started late; otherwise 0. */
export function daysLate(moveIn: string | null, photos: PhotoDTO[]): number {
  if (!moveIn) return 0;
  const first = photos.filter((p) => p.capture === "live").map((p) => p.addedAt).sort()[0];
  if (!first) return 0;
  const day = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  // The first photo's date in India, since move-in dates are Indian calendar days.
  const ist = new Date(new Date(first).getTime() + 5.5 * 3600_000).toISOString();
  return Math.max(0, Math.round((day(ist) - day(moveIn)) / 86_400_000));
}

const NETWORK = /failed to fetch|network|load failed|timed? ?out|connection/i;

/** Runs an upload step again (up to three tries, waiting longer each time) when the connection drops. */
export async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries || !NETWORK.test(e instanceof Error ? e.message : String(e))) throw e;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}
