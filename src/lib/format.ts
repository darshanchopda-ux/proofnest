const DAY = 86_400_000;

/** Rupees with Indian digit grouping: ₹1,50,000. */
export function money(value: number | string | null | undefined): string {
  const v = Number(value) || 0;
  return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function listWords(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

/** Parses a YYYY-MM-DD date as a local calendar day. */
export function parseDay(value: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : null;
}

export function fmtDate(value: string | number | Date | null | undefined, withTime = false): string {
  if (value == null || value === "") return "";
  const ms = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseDay(value) : new Date(value).getTime();
  if (ms == null || Number.isNaN(ms)) return "";
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  if (withTime) Object.assign(options, { hour: "2-digit", minute: "2-digit" });
  return new Date(ms).toLocaleString("en-IN", options);
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function depositMonths(rent: string | number | null | undefined, deposit: string | number | null | undefined): string {
  const r = Number(rent) || 0;
  const d = Number(deposit) || 0;
  if (!r || !d) return "";
  const m = Math.round((d / r) * 10) / 10;
  return `${m} month${m === 1 ? "" : "s"}' rent`;
}

/** When the owner should refund the deposit, from the handover date and the agreement's refund period. */
export function refundInfo(keysHandedOver: string | null, refundDays: number | null): { due: number; left: number } | null {
  const out = parseDay(keysHandedOver);
  if (out == null || refundDays == null || refundDays < 0) return null;
  const due = out + refundDays * DAY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return { due, left: Math.round((due - today.getTime()) / DAY) };
}
