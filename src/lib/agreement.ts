import type { AgreementFacts } from "@/db/schema";
import { fmtDate, money } from "@/lib/format";
import type { FlatDTO, FlatPatch } from "@/lib/types";

export type AgreementProposal = {
  key: keyof FlatPatch;
  label: string;
  /** The flat's current value, formatted, or "" when it's empty. */
  from: string;
  to: string;
  value: string | number;
  /** Ticked by default only when it fills an empty field, never when it would overwrite one. */
  on: boolean;
};

export function refundText(days: number | null | undefined): string {
  if (days == null) return "";
  return days === 0 ? "On the day of handover" : `${days} days after handover`;
}

/** Flat details the agreement states differently from what the tenant has entered. */
export function agreementProposals(flat: FlatDTO, f: AgreementFacts): AgreementProposal[] {
  const out: AgreementProposal[] = [];
  const add = (key: keyof FlatPatch, label: string, current: string | number | null, next: string | number | null | undefined, show: (v: string | number) => string) => {
    if (next == null || next === "") return;
    const empty = current == null || current === "";
    const same = typeof next === "number" ? !empty && Number(current) === next : current === next;
    if (same) return;
    out.push({ key, label, from: empty ? "" : show(current), to: show(next), value: typeof next === "number" && key !== "refundDays" ? String(next) : next, on: empty });
  };
  const text = (v: string | number) => String(v);
  const day = (v: string | number) => fmtDate(String(v));
  add("address", "Flat address", flat.address, f.address, text);
  add("ownerName", "Owner", flat.ownerName, f.owner, text);
  add("tenantName", "Your name", flat.tenantName, f.tenant, text);
  add("moveIn", "Moved in on (agreement start)", flat.moveIn, f.start, day);
  add("monthlyRent", "Monthly rent", flat.monthlyRent, f.rent, money);
  add("deposit", "Security deposit", flat.deposit, f.deposit, money);
  add("refundDays", "Deposit refund", flat.refundDays, f.refundDays, (v) => refundText(Number(v)));
  return out;
}
