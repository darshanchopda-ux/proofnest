"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { fmtIST, plural } from "@/lib/format";
import { answerOwnerReview } from "../actions";

type Answer = { status: "confirmed" | "disputed"; name: string; note: string; at: string };

export function ConfirmForm({ token, tenant, count, defaultName, answer: initial }: { token: string; tenant: string; count: number; defaultName: string; answer: Answer | null }) {
  const [answer, setAnswer] = useState<Answer | null>(initial);
  const [name, setName] = useState(defaultName);
  const [disputing, setDisputing] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (answer) {
    return (
      <section className={`op-answer ${answer.status}`} role="status">
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
      const result = await answerOwnerReview(token, { decision, name, note });
      if (!result.ok) return setError(result.error);
      setAnswer({ status: result.status, name: name.trim(), note: decision === "disputed" ? note.trim() : "", at: result.respondedAt });
    });
  }

  return (
    <section className="op-form" aria-labelledby="op-form-title">
      <h2 id="op-form-title">Do these photos show the flat as it was?</h2>
      <div>
        <label className="lab" htmlFor="op-name">Your name</label>
        <input id="op-name" type="text" value={name} maxLength={120} autoComplete="name" onChange={(e) => setName(e.target.value)} />
      </div>
      {!disputing ? (
        <div className="op-buttons">
          <button className="btn accent big" type="button" disabled={pending} onClick={() => send("confirmed")}>
            <Icon name="check" small />Yes, I confirm these {plural(count, "photo")}
          </button>
          <button className="btn ghost" type="button" disabled={pending} onClick={() => setDisputing(true)}>Something isn&apos;t right</button>
        </div>
      ) : (
        <div className="op-dispute">
          <label className="lab" htmlFor="op-note">What isn&apos;t right?</label>
          <textarea id="op-note" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="For example: the bedroom wardrobe hinge was fixed before they moved in." autoFocus />
          <div className="op-buttons">
            <button className="btn big" type="button" disabled={pending || note.trim().length < 3} onClick={() => send("disputed")}>Send to {tenant}</button>
            <button className="btn ghost" type="button" disabled={pending} onClick={() => setDisputing(false)}>Back</button>
          </div>
        </div>
      )}
      {pending && <p className="status">Saving your answer…</p>}
      {error && <p className="status err" role="alert">{error}</p>}
      <p className="hint" style={{ margin: 0 }}>Your answer is saved with today&apos;s date and time and can&apos;t be changed later.</p>
    </section>
  );
}
