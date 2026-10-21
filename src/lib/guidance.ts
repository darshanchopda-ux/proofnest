import type { IconName } from "@/components/Icon";
import { fmtDate, listWords, plural } from "./format";
import { CONDITIONS, type FlatDTO, type Step } from "./types";

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
  return flat.stage === "moveout" || !!flat.keysHandedOver || !!flat.deductionsText.trim() || flat.chargeCount > 0;
}

export type StepState = "todo" | "partial" | "done";

export function stepStates(flat: FlatDTO): Record<Step, StepState> {
  const cov = coverage(flat);
  return {
    record: cov.total && cov.covered === cov.total ? "done" : flat.photos.length ? "partial" : "todo",
    check: flat.chargeCount ? "done" : "todo",
    letter: flat.letter.trim() ? "done" : "todo",
  };
}

export type NextButton =
  | { kind: "upload"; label: string; room: string }
  | { kind: "step"; label: string; step: Step; icon?: IconName }
  | { kind: "copy-summary"; label: string };

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
      text: "Once your owner has it on WhatsApp, they can't say the flat was different when you moved in.",
      primary: { kind: "copy-summary", label: "Copy WhatsApp message" },
    };
  }
  if (!flat.chargeCount) {
    if (flat.deductionsText.trim()) {
      return {
        key: "run",
        icon: "sparkle",
        title: "Your owner's deductions are saved",
        text: "Claude's charge-by-charge check is the next update to ProofNest. Your list and photos are ready for it.",
      };
    }
    return {
      key: "paste",
      icon: "chat",
      title: "Paste what the owner wants to deduct",
      text: "Copy the owner's WhatsApp message or email into step 2 so it's saved with your move-in photos.",
      primary: { kind: "step", label: "Go to step 2", step: "check", icon: "arrow" },
    };
  }
  return {
    key: "letter",
    icon: "doc",
    title: "Write your refund letter",
    text: "Your decisions are set. The refund letter builds on them.",
    primary: { kind: "step", label: "Go to step 3", step: "letter", icon: "arrow" },
  };
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
    "\nI can share the dated photos on request. Please reply to confirm you have received this.",
    "",
    "Thank you,",
    flat.tenantName || "[Your name]",
  ].join("\n");
}
