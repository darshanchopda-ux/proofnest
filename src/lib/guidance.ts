import type { IconName } from "@/components/Icon";
import { fmtDate, listWords, money, plural } from "./format";
import { CONDITIONS, DISPUTED, type ChargeDTO, type FlatDTO, type Step } from "./types";

export type RoomStat = { name: string; count: number };

export function roomStats(flat: FlatDTO): RoomStat[] {
  const names = [...flat.rooms];
  for (const p of flat.photos) if (!names.includes(p.room)) names.push(p.room);
  return names.map((name) => ({ name, count: flat.photos.filter((p) => p.room === name).length }));
}

export function coverage(flat: FlatDTO) {
  const rooms = roomStats(flat);
  const missing = rooms.filter((r) => !r.count);
  return { rooms, total: rooms.length, covered: rooms.length - missing.length, missing };
}

export function isMoveOut(flat: FlatDTO): boolean {
  return flat.stage === "moveout" || !!flat.keysHandedOver || !!flat.deductionsText.trim() || flat.charges.length > 0;
}

export type StepState = "todo" | "partial" | "done";

export function stepStates(flat: FlatDTO): Record<Step, StepState> {
  const cov = coverage(flat);
  return {
    record: cov.total && cov.covered === cov.total ? "done" : flat.photos.length ? "partial" : "todo",
    check: flat.charges.length ? "done" : "todo",
    letter: flat.letter.trim() ? "done" : "todo",
  };
}

export type NextButton =
  | { kind: "upload"; label: string; room: string }
  | { kind: "step"; label: string; step: Step; icon?: IconName }
  | { kind: "copy-summary"; label: string }
  | { kind: "link"; label: string; href: string; icon: IconName }
  | { kind: "run-check"; label: string }
  | { kind: "copy-letter"; label: string };

export type NextAction = { key: string; icon: IconName; title: string; text: string; primary?: NextButton; secondary?: NextButton };

export function nextAction(flat: FlatDTO): NextAction {
  const cov = coverage(flat);
  if (!isMoveOut(flat)) {
    if (!flat.photos.length) {
      const room = flat.rooms.includes("Kitchen") ? "Kitchen" : cov.rooms[0]?.name ?? "Kitchen";
      return {
        key: "start",
        icon: "camera",
        title: `Start with the ${room.toLowerCase()}`,
        text: "Walk through the flat before you unpack. Take wide shots of every wall and the floor, then close-ups of anything cracked, stained or broken.",
        primary: { kind: "upload", label: `Add ${room} photos`, room },
      };
    }
    if (cov.missing.length) {
      const names = cov.missing.map((r) => r.name);
      return {
        key: `rooms-${names.length}`,
        icon: "camera",
        title: `${plural(names.length, "room")} to go`,
        text: `No photos yet of ${listWords(names)}. Every room you skip is one the owner can argue about later.`,
        primary: { kind: "upload", label: `Add ${names[0]} photos`, room: names[0] },
      };
    }
    return {
      key: "share",
      icon: "chat",
      title: "Record complete. Send it to your owner today.",
      text: "Save your move-in record as a PDF and send it with the message on WhatsApp. Once your owner has it, they can't say the flat was different when you moved in.",
      primary: { kind: "copy-summary", label: "Copy WhatsApp message" },
      secondary: { kind: "link", label: "Move-in record (PDF)", href: `/flats/${flat.id}/report`, icon: "download" },
    };
  }
  if (!flat.charges.length) {
    if (flat.deductionsText.trim()) {
      return {
        key: "run",
        icon: "sparkle",
        title: "Check the owner's deductions",
        text: "AI compares every charge with your move-in photos and notes, and tells you which ones you can dispute.",
        primary: { kind: "run-check", label: "Check with AI" },
      };
    }
    return {
      key: "paste",
      icon: "chat",
      title: "Paste what the owner wants to deduct",
      text: "Copy the owner's WhatsApp message or email into step 2, or add a screenshot of it.",
      primary: { kind: "step", label: "Go to step 2", step: "check", icon: "arrow" },
    };
  }
  if (!flat.letter.trim()) {
    const ask = refundAsk(flat);
    return {
      key: "letter",
      icon: "doc",
      title: ask != null ? `Ask for ${money(ask)} back` : "Write your refund letter",
      text: "Your decisions are set. ProofNest turns them into a polite, firm letter that cites your photos.",
      primary: { kind: "step", label: "Write the letter", step: "letter", icon: "arrow" },
    };
  }
  return {
    key: "send",
    icon: "chat",
    title: "Send the letter to your owner",
    text: "Paste it into WhatsApp or email, and attach your move-in record (PDF) so every photo is on record.",
    primary: { kind: "copy-letter", label: "Copy letter" },
  };
}

export type Totals = { all: number; dispute: number; check: number; accept: number };

export function totals(charges: ChargeDTO[]): Totals {
  const t: Totals = { all: 0, dispute: 0, check: 0, accept: 0 };
  for (const c of charges) {
    t.all += c.amount;
    if (DISPUTED.includes(c.decision)) t.dispute += c.amount;
    else if (c.decision === "check") t.check += c.amount;
    else t.accept += c.amount;
  }
  return t;
}

/** Deposit minus only the charges the tenant accepts, or null when the deposit isn't known. */
export function refundAsk(flat: FlatDTO): number | null {
  const deposit = Number(flat.deposit) || 0;
  return deposit ? Math.max(0, deposit - totals(flat.charges).accept) : null;
}

/** A message the tenant can paste into WhatsApp or email on the day they move in. */
export function summaryText(flat: FlatDTO): string {
  const rooms = roomStats(flat).filter((r) => r.count).map((r) => `${r.name} (${r.count})`);
  const issues = flat.photos
    .filter((p) => p.condition !== "good" || p.note)
    .map((p) => `- P${p.n}, ${p.room}, ${CONDITIONS[p.condition].toLowerCase()}${p.note ? `: ${p.note}` : ""}${p.takenAt ? ` (taken ${fmtDate(p.takenAt, true)})` : ""}`);
  return [
    `Hello ${flat.ownerName || "[Owner's name]"},`,
    "",
    `Sharing the condition of ${flat.address || "the flat"} at move-in${flat.moveIn ? ` on ${fmtDate(flat.moveIn)}` : ""} for our records.`,
    "",
    `I took ${flat.photos.length} photos across ${rooms.join(", ") || "no rooms yet"}.`,
    issues.length ? `\nExisting damage and wear I noticed:\n${issues.join("\n")}` : "",
    "\nMy move-in record (PDF, attached) has every photo with the time it was taken. Please reply to confirm you have received it.",
    "",
    "Thank you,",
    flat.tenantName || "[Your name]",
  ].join("\n");
}
