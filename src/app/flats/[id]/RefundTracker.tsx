"use client";

import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { addRefundEntry, deleteRefundEntry } from "@/app/flats/actions";
import { fmtDate, money, refundInfo } from "@/lib/format";
import type { FlatDTO, RefundDTO } from "@/lib/types";

/** Tracks what the owner has paid back and what they say they're keeping, so the tenant always knows what's still owed. */
export function RefundTracker({ flat, setFlat }: { flat: FlatDTO; setFlat: Dispatch<SetStateAction<FlatDTO>> }) {
  const toast = useToast();
  const [kind, setKind] = useState<RefundDTO["kind"]>("received");
  const [amount, setAmount] = useState("");
  const [on, setOn] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const deposit = Number(flat.deposit) || 0;
  const received = flat.refunds.filter((r) => r.kind === "received").reduce((n, r) => n + r.amount, 0);
  const held = flat.refunds.filter((r) => r.kind === "held").reduce((n, r) => n + r.amount, 0);
  const owed = Math.max(0, deposit - received);
  const due = refundInfo(flat.keysHandedOver, flat.refundDays);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const result = await addRefundEntry(flat.id, { kind, amount, on, note });
      if (!result.ok) return toast(result.error, "bad");
      setFlat((f) => ({ ...f, refunds: [...f.refunds, result.data] }));
      setAmount("");
      setNote("");
    } catch {
      toast("Couldn't save that. Check your connection and try again.", "bad");
    } finally {
      setBusy(false);
    }
  }

  async function remove(r: RefundDTO) {
    setFlat((f) => ({ ...f, refunds: f.refunds.filter((x) => x.id !== r.id) }));
    const result = await deleteRefundEntry(flat.id, r.id).catch(() => ({ ok: false as const, error: "Couldn't remove it. Check your connection." }));
    if (!result.ok) {
      setFlat((f) => ({ ...f, refunds: [...f.refunds, r] }));
      toast(result.error, "bad");
    }
  }

  return (
    <section className="refunds" aria-labelledby="rf-title">
      <h3 id="rf-title">Money back</h3>
      {deposit > 0 ? (
        <dl className="rf-sum">
          <div><dt>Deposit</dt><dd>{money(deposit)}</dd></div>
          <div><dt>Received</dt><dd>{money(received)}</dd></div>
          <div className={owed ? "owed" : "paid"}><dt>Still with the owner</dt><dd>{money(owed)}</dd></div>
        </dl>
      ) : (
        <p className="hint">Add your security deposit in Edit details to see what&apos;s still owed.</p>
      )}
      {held > 0 && <p className="hint">The owner says they&apos;re keeping {money(held)} of it. Dispute what you don&apos;t accept in your letter.</p>}
      {owed > 0 && due && due.left < 0 && (
        <p className="rf-late">The refund was due {fmtDate(new Date(due.due))}, {Math.abs(due.left)} days ago. Send a polite reminder with your letter attached.</p>
      )}

      {flat.refunds.length > 0 && (
        <ul className="rf-list">
          {flat.refunds.map((r) => (
            <li key={r.id}>
              <span className={`chip ${r.kind === "held" ? "check" : "ok"}`}>{r.kind === "held" ? "Owner keeping" : "Received"}</span>
              <b>{money(r.amount)}</b>
              <span className="muted">{[r.on ? fmtDate(r.on) : "", r.note].filter(Boolean).join(" · ")}</span>
              <button className="iconbtn" type="button" onClick={() => remove(r)} aria-label={`Remove ${money(r.amount)} entry`}><Icon name="trash" small /></button>
            </li>
          ))}
        </ul>
      )}

      <form className="rf-add" onSubmit={add}>
        <label className="sr" htmlFor="rf-kind">Type</label>
        <select id="rf-kind" value={kind} onChange={(e) => setKind(e.target.value === "held" ? "held" : "received")}>
          <option value="received">Received back</option>
          <option value="held">Owner is keeping</option>
        </select>
        <label className="sr" htmlFor="rf-amount">Amount in rupees</label>
        <input id="rf-amount" type="number" min={1} inputMode="numeric" placeholder="₹ amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <label className="sr" htmlFor="rf-on">Date</label>
        <input id="rf-on" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
        <label className="sr" htmlFor="rf-note">Note</label>
        <input id="rf-note" type="text" maxLength={200} placeholder="UPI ref, or what it's for" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn small ghost" type="submit" disabled={busy || !amount}>Add</button>
      </form>
    </section>
  );
}
