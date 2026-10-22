import { totals } from "./guidance";
import { fmtDate, money } from "./format";
import { DISPUTED, type FlatDTO } from "./types";

/** A refund letter built from the tenant's decisions without AI. Used when the AI isn't available or not wanted. */
export function templateLetter(flat: FlatDTO): string {
  const t = totals(flat.charges);
  const deposit = Number(flat.deposit) || 0;
  const owner = flat.ownerName || "[Owner's name]";
  const photoByN = new Map([...flat.photos, ...flat.moveOutPhotos].map((p) => [p.n, p]));
  const cite = (ns: number[]) => {
    const refs = ns
      .map((n) => photoByN.get(n))
      .filter((p) => p != null)
      .map((p) => `Photo P${p.n} (${p.room}${p.phase === "moveout" ? " at move-out" : ""}${p.takenAt ? `, taken ${fmtDate(p.takenAt)}` : ""})`);
    return refs.length ? ` ${refs.join(" and ")} ${refs.length > 1 ? "show" : "shows"} this.` : "";
  };

  const lines: string[] = [];
  lines.push(flat.tenantName || "[Your name]", "[Your current address]", "[Your phone number]", fmtDate(new Date()), "");
  lines.push("To,", owner, flat.address || "[Flat address]", "");
  lines.push(`Subject: Refund of security deposit for ${flat.address || "[flat address]"}`, "");
  lines.push(`Dear ${owner},`, "");
  lines.push(
    `I vacated ${flat.address || "the flat"}${flat.keysHandedOver ? ` and handed over the keys on ${fmtDate(flat.keysHandedOver)}` : ""}. ` +
      `You have proposed deductions of ${money(t.all)} from my security deposit${deposit ? ` of ${money(deposit)}` : ""}. ` +
      (t.dispute ? `I do not agree with ${money(t.dispute)} of these deductions, for the reasons below. ` : "") +
      "My move-in photos with dates are attached.",
    "",
  );

  let n = 1;
  for (const c of flat.charges.filter((c) => DISPUTED.includes(c.decision))) {
    const why =
      c.decision === "already_there"
        ? "This damage was already there when I moved in." + cite(c.photoNs)
        : c.decision === "wear_and_tear"
          ? "This is normal wear and tear from regular use during my stay." + cite(c.photoNs)
          : "No bill or receipt has been shared for this charge. Please share it.";
    lines.push(`${n++}. ${c.item}: ${money(c.amount)}. ${why}`, "");
  }
  for (const c of flat.charges.filter((c) => c.decision === "check")) {
    lines.push(`${n++}. ${c.item}: ${money(c.amount)}. Please explain this charge and share the bill or any supporting documents.`, "");
  }
  const accepted = flat.charges.filter((c) => c.decision === "likely_valid");
  if (accepted.length) {
    lines.push(`I accept the following charge${accepted.length > 1 ? "s" : ""}: ${accepted.map((c) => `${c.item} (${money(c.amount)})`).join(", ")}.`, "");
  }
  lines.push(
    deposit
      ? `Please refund ${money(Math.max(0, deposit - t.accept))} (my deposit of ${money(deposit)} minus the charges I accept) to my bank account or UPI ID [your UPI ID] within 7 days. If you want to deduct anything else, please share the bills first.`
      : "Please refund the balance of my deposit to my bank account or UPI ID [your UPI ID] within 7 days. If you want to deduct anything else, please share the bills first.",
    "",
  );
  lines.push("Regards,", flat.tenantName || "[Your name]");
  return lines.join("\n");
}
