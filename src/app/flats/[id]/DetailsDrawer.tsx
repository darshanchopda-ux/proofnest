"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { deleteFlat } from "@/app/flats/actions";
import { useDialogFocus } from "@/components/useDialogFocus";
import { depositMonths } from "@/lib/format";
import type { FlatDTO, FlatPatch } from "@/lib/types";
import { Flatmates } from "./Flatmates";
import HoldButton from "@/components/kokonutui/hold-button";

type Field =
  | "address"
  | "ownerName"
  | "tenantName"
  | "moveIn"
  | "keysHandedOver"
  | "monthlyRent"
  | "deposit"
  | "refundDays"
  | "depositPaidOn"
  | "depositPaidTo"
  | "depositRef"
  | "depositHolder";

export function DetailsDrawer({
  flat,
  setFlat,
  patchFlat,
  onClose,
}: {
  flat: FlatDTO;
  setFlat: Dispatch<SetStateAction<FlatDTO>>;
  patchFlat: (patch: FlatPatch, delay?: number) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [deleting, startDelete] = useTransition();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  useDialogFocus(panel);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  function input(field: Field, label: string, type: "text" | "date" | "number", hint?: string) {
    const raw = flat[field];
    return (
      <div>
        <label className="lab" htmlFor={`f-${field}`}>{label}</label>
        <input
          id={`f-${field}`}
          type={type}
          maxLength={type === "text" ? (field === "address" || field === "depositHolder" ? 200 : 120) : undefined}
          value={raw == null ? "" : String(raw)}
          min={type === "number" ? 0 : undefined}
          inputMode={type === "number" ? "numeric" : undefined}
          onChange={(e) => {
            const value = e.target.value;
            if (field === "refundDays") patchFlat({ refundDays: value === "" ? null : Number(value) });
            else if (field === "depositPaidTo" || field === "depositRef" || field === "depositHolder") patchFlat({ [field]: value } as FlatPatch);
            else patchFlat({ [field]: value === "" && field !== "address" ? null : value } as FlatPatch);
          }}
        />
        {hint && <p className="hint">{hint}</p>}
      </div>
    );
  }

  function remove() {
    startDelete(async () => {
      const result = await deleteFlat(flat.id);
      if (result && !result.ok) toast(result.error, "bad");
    });
  }

  const months = depositMonths(flat.monthlyRent, flat.deposit);

  return (
    <>
      <motion.div className="overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%", transition: { duration: 0.2 } }} className="drawer" ref={panel} role="dialog" aria-modal="true" aria-labelledby="dr-title">
        <div className="dr-head">
          <h2 id="dr-title" style={{ fontSize: "1.3rem" }}>Flat details</h2>
          <button ref={closeRef} className="iconbtn" type="button" onClick={onClose} aria-label="Close"><Icon name="close" small /></button>
        </div>
        <div className="dr-body">
          {input("address", "Flat address", "text")}
          {input("ownerName", "Owner or landlord", "text")}
          {input("tenantName", "Your name", "text", "Used to sign your messages and letter.")}
          <div className="pair">
            {input("moveIn", "Moved in on", "date")}
            {input("keysHandedOver", "Keys handed over", "date")}
          </div>
          <div className="pair">
            {input("monthlyRent", "Monthly rent (₹)", "number")}
            {input("deposit", "Security deposit (₹)", "number")}
          </div>
          {months && <p className="hint" style={{ marginTop: -6 }}>Deposit is {months}.</p>}
          {input(
            "refundDays",
            "Refund due (days after handover)",
            "number",
            "Check the refund clause in your rent agreement. Enter 0 if it's due on the day you hand over the keys.",
          )}
          <div className="sec">
            <h3 className="mini">Deposit receipt</h3>
            <p className="hint" style={{ margin: 0 }}>
              Proof you paid the deposit. Keep the bank or UPI screenshot too; your letter mentions these details.
            </p>
            <div className="pair">
              {input("depositPaidOn", "Paid on", "date")}
              {input("depositPaidTo", "Paid to", "text")}
            </div>
            {input("depositRef", "UPI, bank or cheque reference", "text")}
            {input(
              "depositHolder",
              "Who holds the deposit now",
              "text",
              "Leave empty if it's the owner. If the flat was sold, the owner lives abroad or a broker took the deposit, write who has it now.",
            )}
          </div>
          <Flatmates flat={flat} setFlat={setFlat} />
          {flat.access === "owner" && (
            <div className="sec">
              <p className="hint" style={{ margin: 0 }}>Deleting removes this flat and its photos for good, for your flatmates too.</p>
              <HoldButton className="kk justify-self-start" holdDuration={1600} onHoldComplete={remove} disabled={deleting} resetAfter={0} completeLabel="Deleting…">
                Hold to delete this flat
              </HoldButton>
            </div>
          )}
        </div>
      </motion.aside>
    </>
  );
}
