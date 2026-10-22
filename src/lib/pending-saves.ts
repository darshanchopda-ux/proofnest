// Debounced saves that still reach the server if the tab is closed or hidden before they run.

type Pending = { timer: ReturnType<typeof setTimeout>; urgent: () => void };
const pending = new Map<string, Pending>();

/**
 * Runs `save` after `delay`, replacing any save still waiting under the same key. If the page is hidden or closed
 * first, `urgent` runs instead: it should send the same change with sendOnUnload, which outlives the page.
 */
export function scheduleSave(key: string, delay: number, save: () => void, urgent: () => void) {
  const before = pending.get(key);
  if (before) clearTimeout(before.timer);
  const timer = setTimeout(() => {
    pending.delete(key);
    save();
  }, delay);
  pending.set(key, { timer, urgent });
}

/** Sends every waiting save now. Called when the page is hidden or about to close. */
export function flushSaves() {
  for (const p of pending.values()) {
    clearTimeout(p.timer);
    p.urgent();
  }
  pending.clear();
}

/** POSTs JSON with keepalive, so the request completes even as the page unloads (limit about 64 KB). */
export function sendOnUnload(url: string, body: unknown) {
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
}
