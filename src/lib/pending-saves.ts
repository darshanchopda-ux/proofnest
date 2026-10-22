// Debounced saves that still reach the server if the tab is closed or hidden before they run.

type Pending = { timer: ReturnType<typeof setTimeout>; urgent: () => void };
const pending = new Map<string, Pending>();
let running = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** For the "Saving… / Saved" indicator: how many edits are waiting or on their way to the server. */
export function savesInFlight(): number {
  return pending.size + running;
}

export function subscribeSaves(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Runs `save` after `delay`, replacing any save still waiting under the same key. If the page is hidden or closed
 * first, `urgent` runs instead: it should send the same change with sendOnUnload, which outlives the page.
 */
export function scheduleSave(key: string, delay: number, save: () => unknown, urgent: () => void) {
  const before = pending.get(key);
  if (before) clearTimeout(before.timer);
  const timer = setTimeout(() => {
    pending.delete(key);
    running++;
    notify();
    Promise.resolve()
      .then(save)
      .catch(() => {})
      .finally(() => {
        running--;
        notify();
      });
  }, delay);
  pending.set(key, { timer, urgent });
  notify();
}

/** Sends every waiting save now. Called when the page is hidden or about to close. */
export function flushSaves() {
  for (const p of pending.values()) {
    clearTimeout(p.timer);
    p.urgent();
  }
  pending.clear();
  notify();
}

/** POSTs JSON with keepalive, so the request completes even as the page unloads (limit about 64 KB). */
export function sendOnUnload(url: string, body: unknown) {
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
}
