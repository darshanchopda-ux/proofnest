"use client";

import { useState, useTransition } from "react";
import { requestWhatsAppCode } from "@/app/auth/actions";
import { useToast } from "@/components/Toast";
import { addBackupPhone, deleteAccount, disablePhone, enablePhone, removeBackupPhone, signOutEverywhere } from "./actions";

type Number = { phone: string; display: string; primary: boolean; off: boolean };

export function BackupPhones({ numbers, canSend }: { numbers: Number[]; canSend: boolean }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [armed, setArmed] = useState("");
  const [error, setError] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string } | void>, done?: string) =>
    start(async () => {
      setError("");
      const result = await fn();
      if (result && !result.ok) return setError(result.error ?? "Something went wrong.");
      if (done) toast(done);
      window.location.reload();
    });

  return (
    <>
      <ul className="acc-numbers">
        {numbers.map((n) => (
          <li key={n.phone} className={n.off ? "off" : ""}>
            <b>{n.display}</b>
            <span className="muted">{n.off ? "Switched off" : n.primary ? "Main number" : "Backup"}</span>
            {n.off ? (
              <button className="btn small ghost" type="button" disabled={pending} onClick={() => run(() => enablePhone(n.phone), "Number switched back on.")}>Switch on</button>
            ) : (
              <button
                className={`btn small ghost ${armed === n.phone ? "armed" : ""}`}
                type="button"
                disabled={pending}
                onClick={() => {
                  if (armed !== n.phone) {
                    setArmed(n.phone);
                    setTimeout(() => setArmed(""), 4000);
                    return;
                  }
                  run(() => disablePhone(n.phone));
                }}
              >
                {armed === n.phone ? "Switch off and sign out everywhere?" : "Lost this number"}
              </button>
            )}
            {!n.primary && (
              <button className="linkbtn" type="button" disabled={pending} onClick={() => run(() => removeBackupPhone(n.phone), "Backup number removed.")}>Remove</button>
            )}
          </li>
        ))}
      </ul>
      <p className="hint">
        Lost your phone or changed your number? Add a backup number now. If a number is lost, switch it off: it can&apos;t sign in any more, even if
        the operator gives it to someone else, and every device is signed out.
      </p>
      {!adding ? (
        <button className="btn small ghost" type="button" onClick={() => setAdding(true)} disabled={!canSend}>Add a backup number</button>
      ) : !sentTo ? (
        <form
          className="acc-add"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              setError("");
              const r = await requestWhatsAppCode(phone);
              if (!r.ok) return setError(r.error);
              setSentTo(r.phone);
              toast(r.note ?? `Code sent on WhatsApp to ${r.display}.`);
            });
          }}
        >
          <label className="lab" htmlFor="acc-phone">Backup WhatsApp number</label>
          <input id="acc-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button className="btn small accent" type="submit" disabled={pending || phone.replace(/\D/g, "").length < 10}>Send code</button>
        </form>
      ) : (
        <form
          className="acc-add"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addBackupPhone(sentTo, code), "Backup number added.");
          }}
        >
          <label className="lab" htmlFor="acc-code">6-digit code sent to {phone}</label>
          <input id="acc-code" className="code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <button className="btn small accent" type="submit" disabled={pending || code.length !== 6}>Add number</button>
        </form>
      )}
      {error && <p className="status err" role="alert">{error}</p>}
    </>
  );
}

export function SignOutEverywhere() {
  const [pending, start] = useTransition();
  return (
    <button className="btn small ghost" type="button" disabled={pending} onClick={() => start(() => signOutEverywhere())}>
      {pending ? "Signing out…" : "Sign out everywhere"}
    </button>
  );
}

export function AccountDanger({ needsPassword }: { needsPassword: boolean }) {
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="acc-add"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await deleteAccount(confirm, password);
          if (r && !r.ok) setError(r.error);
        });
      }}
    >
      <label className="lab" htmlFor="acc-confirm">Type DELETE to confirm</label>
      <input id="acc-confirm" type="text" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      {needsPassword && (
        <>
          <label className="lab" htmlFor="acc-password">Your password</label>
          <input id="acc-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </>
      )}
      <button className="btn small ghost danger" type="submit" disabled={pending || confirm.trim().toUpperCase() !== "DELETE"}>
        {pending ? "Deleting…" : "Delete my account and data"}
      </button>
      {error && <p className="status err" role="alert">{error}</p>}
    </form>
  );
}
