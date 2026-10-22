"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { ProofSeal } from "@/components/ProofSeal";
import { fmtIST, plural } from "@/lib/format";
import { answerOwnerReview } from "../actions";

type Answer = { status: "confirmed" | "disputed"; name: string; role: string; note: string; at: string };

const ROLES: [string, string][] = [
  ["owner", "The owner"],
  ["agent", "Broker or agent"],
  ["family", "Owner's family"],
];

type Props = { token: string; tenant: string; count: number; kind: "movein" | "moveout"; defaultName: string; answer: Answer | null };

export function ConfirmForm({ token, tenant, count, kind, defaultName, answer: initial }: Props) {
  const [answer, setAnswer] = useState<Answer | null>(initial);
  const [name, setName] = useState(defaultName);
  const [role, setRole] = useState("");
  const [disputing, setDisputing] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (answer) {
    return (
      <section className={`op-answer ${answer.status}`} role="status">
        {answer.status === "confirmed" && (
          <ProofSeal top="CONFIRMED BY OWNER" bottom={fmtIST(answer.at).toUpperCase()} center="✓" size={96} press={!initial} delay={0.05} label="Confirmed" />
        )}
        <b>
          {answer.status === "confirmed" ? <><Icon name="check" small />Confirmed by {answer.name}</> : <>{answer.name} said something isn&apos;t right</>}
        </b>
        <span>{fmtIST(answer.at)}</span>
        {answer.note && <blockquote>&ldquo;{answer.note}&rdquo;</blockquote>}
        <p>{tenant} can see this answer now. You can close this page.</p>
      </section>
    );
  }

  function send(decision: "confirmed" | "disputed") {
    setError("");
    start(async () => {
      const result = await answerOwnerReview(token, { decision, name, note, role });
      if (!result.ok) return setError(result.error);
      setAnswer({ status: result.status, name: name.trim(), role, note: decision === "disputed" ? note.trim() : "", at: result.respondedAt });
    });
  }

  return (
    <section className="op-form" aria-labelledby="op-form-title">
      <h2 id="op-form-title">{kind === "moveout" ? "Do these photos show the flat as it was handed back?" : "Do these photos show the flat as it was?"}</h2>
      <div>
        <label className="lab" htmlFor="op-name">Your name</label>
        <input id="op-name" type="text" value={name} maxLength={120} autoComplete="name" onChange={(e) => setName(e.target.value)} />
      </div>
      <fieldset className="op-role">
        <legend className="lab">You are</legend>
        <div className="seg">
          {ROLES.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={role === id} onClick={() => setRole(id)}>{label}</button>
          ))}
        </div>
      </fieldset>
      {!disputing ? (
        <div className="op-buttons">
          <button className="btn accent big" type="button" disabled={pending || !role} onClick={() => send("confirmed")}>
            <Icon name="check" small />Yes, I confirm these {plural(count, "photo")}
          </button>
          <button className="btn ghost" type="button" disabled={pending} onClick={() => setDisputing(true)}>Something isn&apos;t right</button>
        </div>
      ) : (
        <div className="op-dispute">
          <label className="lab" htmlFor="op-note">What isn&apos;t right?</label>
          <textarea id="op-note" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="For example: the bedroom wardrobe hinge was fixed before they moved in." autoFocus />
          <div className="op-buttons">
            <button className="btn big" type="button" disabled={pending || !role || note.trim().length < 3} onClick={() => send("disputed")}>Send to {tenant}</button>
            <button className="btn ghost" type="button" disabled={pending} onClick={() => setDisputing(false)}>Back</button>
          </div>
        </div>
      )}
      {!role && <p className="hint" style={{ margin: 0 }}>Choose who you are first.</p>}
      {pending && <p className="status">Saving your answer…</p>}
      {error && <p className="status err" role="alert">{error}</p>}
      <p className="hint" style={{ margin: 0 }}>Your answer is saved with today&apos;s date and time and can&apos;t be changed later.</p>
    </section>
  );
}
