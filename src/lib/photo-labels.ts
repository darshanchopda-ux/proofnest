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

/** Resolves when the browser is back online, or after `ms` (patchy 4G often comes back without an "online" event). */
function backOnline(ms: number): Promise<void> {
  if (typeof navigator === "undefined" || navigator.onLine) return new Promise((r) => setTimeout(r, ms));
  return new Promise((resolve) => {
    const done = () => {
      window.removeEventListener("online", done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, Math.max(ms, 15_000));
    window.addEventListener("online", done);
  });
}

/**
 * Runs an upload step again when the connection drops: quickly at first, then waiting for the network to come back,
 * for up to about two minutes, so a photo taken in a lift or a basement still reaches the record.
 */
export async function withRetry<T>(fn: () => Promise<T>, tries = 6): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries || !NETWORK.test(e instanceof Error ? e.message : String(e))) throw e;
      await backOnline(1500 * i);
    }
  }
}
