"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { createFlat } from "@/app/flats/actions";
import { todayISO } from "@/lib/format";
import type { NewFlatInput } from "@/lib/types";

type Key = keyof Omit<NewFlatInput, "stage">;

export function NewFlatWizard() {
  const stage = useSearchParams().get("stage") === "moveout" ? "moveout" : "movein";
  const moveOut = stage === "moveout";
  const [step, setStep] = useState<1 | 2>(1);
  const [dir, setDir] = useState<"fwd" | "back" | "">("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  // This component renders in the browser (it reads the URL), so todayISO() uses the user's own time zone.
  const [data, setData] = useState<NewFlatInput>(() => ({
    stage,
    address: "",
    ownerName: "",
    moveIn: moveOut ? "" : todayISO(),
    keysHandedOver: moveOut ? todayISO() : "",
    monthlyRent: "",
    deposit: "",
    refundDays: "",
  }));
  const firstInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInput.current?.focus();
  }, [step]);

  const set = (key: Key) => (e: { target: { value: string } }) => setData((d) => ({ ...d, [key]: e.target.value }));

  function field(key: Key, label: string, type: "text" | "date" | "number", placeholder?: string, hint?: string, first?: boolean) {
    return (
      <div>
        <label className="lab" htmlFor={`wz-${key}`}>{label}</label>
        <input
          ref={first ? firstInput : undefined}
          id={`wz-${key}`}
          type={type}
          value={data[key]}
          onChange={set(key)}
          placeholder={placeholder}
          min={type === "number" ? 0 : undefined}
          inputMode={type === "number" ? "numeric" : undefined}
        />
        {hint && <p className="hint">{hint}</p>}
      </div>
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (step === 1) {
      if (!data.address.trim()) {
        setError("Add the flat's address to continue.");
        firstInput.current?.focus();
        return;
      }
      setDir("fwd");
      setStep(2);
      return;
    }
    startTransition(async () => {
      const result = await createFlat(data);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <div className="modal" role="region" aria-labelledby="wz-title">
      <div className="wz-top">
        <span className="eyebrow">{moveOut ? "Moving out" : "Moving in"} · Step {step} of 2</span>
        <Link className="iconbtn" href="/" aria-label="Cancel and go back"><Icon name="close" small /></Link>
      </div>
      <div className="wz-prog" aria-hidden="true">
        <i className="on" />
        <i className={step === 2 ? "on" : ""} />
      </div>
      <h2 id="wz-title">{step === 1 ? "Which flat is this?" : moveOut ? "About your move-out" : "About your move-in"}</h2>
      <form key={step} className={`wz-body ${dir}`} onSubmit={submit} autoComplete="off">
        {step === 1 ? (
          <>
            {field("address", "Flat address", "text", "Flat 302, Sunrise Apartments, HSR Layout, Bengaluru", undefined, true)}
            {field("ownerName", "Owner's name", "text", "As in your rent agreement", "Optional. Used in your messages and letter.")}
          </>
        ) : moveOut ? (
          <>
            <div className="pair">
              {field("moveIn", "Moved in on", "date", undefined, undefined, true)}
              {field("keysHandedOver", "Keys handed over on", "date")}
            </div>
            <div className="pair">
              {field("deposit", "Security deposit (₹)", "number", "1,50,000")}
              {field("refundDays", "Refund due in (days)", "number", "e.g. 0 or 30")}
            </div>
            <p className="hint" style={{ marginTop: -6 }}>
              Check the refund clause in your rent agreement. Enter 0 if the deposit is due on the day you hand over the keys.
            </p>
          </>
        ) : (
          <>
            {field("moveIn", "Moving in on", "date", undefined, undefined, true)}
            <div className="pair">
              {field("monthlyRent", "Monthly rent (₹)", "number", "30,000")}
              {field("deposit", "Security deposit (₹)", "number", "1,50,000")}
            </div>
            <p className="hint" style={{ marginTop: -6 }}>You can change any of this later.</p>
          </>
        )}
        {error && <p className="status err" role="alert">{error}</p>}
        <div className="wz-foot">
          {step === 2 ? (
            <button className="btn ghost" type="button" onClick={() => { setDir("back"); setStep(1); }}>Back</button>
          ) : (
            <Link className="linkbtn" href="/">Cancel</Link>
          )}
          <button className="btn accent" type="submit" disabled={pending}>
            {step === 1 ? <>Continue <Icon name="arrow" small /></> : pending ? "Creating…" : <>Create my flat <Icon name="check" small /></>}
          </button>
        </div>
      </form>
    </div>
  );
}
