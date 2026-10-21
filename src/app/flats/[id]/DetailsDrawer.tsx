"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { deleteFlat } from "@/app/flats/actions";
import { depositMonths } from "@/lib/format";
import type { FlatDTO, FlatPatch } from "@/lib/types";

type Field = "address" | "ownerName" | "tenantName" | "moveIn" | "keysHandedOver" | "monthlyRent" | "deposit" | "refundDays";

export function DetailsDrawer({
  flat,
  patchFlat,
  onClose,
}: {
  flat: FlatDTO;
  patchFlat: (patch: FlatPatch, delay?: number) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [armed, setArmed] = useState(false);
  const [deleting, startDelete] = useTransition();
  const closeRef = useRef<HTMLButtonElement>(null);

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
          value={raw == null ? "" : String(raw)}
          min={type === "number" ? 0 : undefined}
          inputMode={type === "number" ? "numeric" : undefined}
          onChange={(e) => {
            const value = e.target.value;
            if (field === "refundDays") patchFlat({ refundDays: value === "" ? null : Number(value) });
            else patchFlat({ [field]: value === "" && field !== "address" ? null : value } as FlatPatch);
          }}
        />
        {hint && <p className="hint">{hint}</p>}
      </div>
    );
  }

  function remove() {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 3500);
      return;
    }
    startDelete(async () => {
      const result = await deleteFlat(flat.id);
      if (result && !result.ok) toast(result.error, "bad");
    });
  }

  const months = depositMonths(flat.monthlyRent, flat.deposit);

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="dr-title">
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
            <p className="hint" style={{ margin: 0 }}>Deleting removes this flat and its photos for good.</p>
            <button
              className={`btn small ghost danger ${armed ? "armed" : ""}`}
              type="button"
              onClick={remove}
              disabled={deleting}
              style={{ justifySelf: "start" }}
            >
              <Icon name="trash" small />
              {deleting ? "Deleting…" : armed ? "Click again to delete for good" : "Delete this flat"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
