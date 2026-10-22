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

/**
 * A calendar date (YYYY-MM-DD) is shown as written; a moment in time is shown in IST. Neither depends on the
 * server's or the browser's time zone, so dates match on both and in letters written on a UTC server.
 */
export function fmtDate(value: string | number | Date | null | undefined, withTime = false): string {
  if (value == null || value === "") return "";
  const day = typeof value === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (day) {
    return new Date(Date.UTC(+day[1], +day[2] - 1, +day[3])).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) return "";
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" };
  if (withTime) Object.assign(options, { hour: "2-digit", minute: "2-digit" });
  return new Date(ms).toLocaleString("en-IN", options);
}

/** Date and time in IST whatever the device's or server's time zone, for records about flats in India. */
export function fmtIST(value: string | number | Date): string {
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) + " IST";
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
  return m === 1 ? "1 month's rent" : `${m} months' rent`;
}

/** Today's date in India, as whole days since 1970, whatever the device's time zone. */
function todayInIndia(): number {
  const [y, m, d] = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
}

/**
 * When the owner should refund the deposit, from the handover date and the agreement's refund period.
 * Counts whole calendar days in India, so it's the same on a UTC server and in the browser, and across clock changes.
 */
export function refundInfo(keysHandedOver: string | null, refundDays: number | null): { due: number; left: number } | null {
  const out = /^(\d{4})-(\d{2})-(\d{2})$/.exec(keysHandedOver ?? "");
  if (!out || refundDays == null || refundDays < 0) return null;
  const dueDay = Date.UTC(+out[1], +out[2] - 1, +out[3]) / DAY + refundDays;
  return { due: dueDay * DAY, left: dueDay - todayInIndia() };
}
