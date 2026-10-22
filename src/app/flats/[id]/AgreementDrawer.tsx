"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { markAgreementReviewed, removeAgreement } from "@/app/flats/actions";
import { useDialogFocus } from "@/components/useDialogFocus";
import { agreementProposals, refundText } from "@/lib/agreement";
import { fmtDate, money, plural } from "@/lib/format";
import type { FlatDTO, FlatPatch } from "@/lib/types";

export type AgreementReadState = { phase: "idle" | "uploading" | "reading"; status: string; error: boolean; canRetry: boolean };

const MESSAGES = [
  "Opening your agreement…",
  "Finding the deposit refund clause…",
  "Looking for painting and repair charges…",
  "Checking the lock-in and notice period…",
  "Noting terms to watch at move-out…",
];

type Props = {
  flat: FlatDTO;
  setFlat: Dispatch<SetStateAction<FlatDTO>>;
  patchFlat: (patch: FlatPatch, delay?: number) => void;
  read: AgreementReadState;
  onRead: (files: File[], text: string) => void;
  onRetry: () => void;
  onStop: () => void;
  onClose: () => void;
};

export function AgreementDrawer({ flat, setFlat, patchFlat, read, onRead, onRetry, onStop, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  useDialogFocus(panel);
  const busy = read.phase !== "idle";

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="drawer wide" ref={panel} role="dialog" aria-modal="true" aria-labelledby="ag-title">
        <div className="dr-head">
          <h2 id="ag-title" style={{ fontSize: "1.3rem" }}>Rent agreement</h2>
          <button ref={closeRef} className="iconbtn" type="button" onClick={onClose} aria-label="Close"><Icon name="close" small /></button>
        </div>
        <div className="dr-body">
          {busy ? (
            <Reading read={read} onStop={onStop} />
          ) : flat.agreement ? (
            <AgreementView key={flat.agreement.readAt ?? ""} flat={flat} setFlat={setFlat} patchFlat={patchFlat} read={read} onRead={onRead} onRetry={onRetry} />
          ) : (
            <Upload read={read} onRead={onRead} onRetry={onRetry} />
          )}
        </div>
      </aside>
    </>
  );
}

function Reading({ read, onStop }: { read: AgreementReadState; onStop: () => void }) {
  const [msg, setMsg] = useState(0);
  useEffect(() => {
    if (read.phase !== "reading") return;
    const id = setInterval(() => setMsg((m) => Math.min(m + 1, MESSAGES.length - 1)), 4000);
    return () => clearInterval(id);
  }, [read.phase]);
  return (
    <>
      <div className="progress-card" style={{ margin: 0 }}>
        <div className="pbar"><i /></div>
        <p className="pmsg" role="status" aria-live="polite">
          <Icon name="doc" small />
          <span key={read.phase === "reading" ? msg : read.status}>{read.phase === "reading" ? MESSAGES[msg] : read.status}</span>
        </p>
        {[0, 1].map((k) => (
          <div className="skrow" key={k}><span className="skel w60" /><span className="skel w90" /><span className="skel w30" /></div>
        ))}
      </div>
      <p className="hint" style={{ margin: 0 }}>This usually takes under a minute. You can close this panel; reading carries on.</p>
      <button className="btn small ghost" type="button" onClick={onStop} style={{ justifySelf: "start" }}>Stop</button>
    </>
  );
}

function Upload({ read, onRead, onRetry }: { read: AgreementReadState; onRead: Props["onRead"]; onRetry: () => void }) {
  const [drag, setDrag] = useState(false);
  const [pasted, setPasted] = useState("");
  return (
    <>
      <p className="muted" style={{ margin: 0 }}>
        Upload your rent agreement or leave and licence agreement. The AI reads the deposit, painting, repair, lock-in and notice clauses,
        offers to fill in your flat details, and uses those clauses when it checks the owner&apos;s deductions and writes your letter.
      </p>
      <label
        className={`agtile file-btn ${drag ? "drag" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files.length) onRead(Array.from(e.dataTransfer.files), "");
        }}
      >
        <Icon name="doc" />
        <b>Upload rent agreement</b>
        <span>A PDF, or a photo of each page. You can also drop files here.</span>
        <FileInput label="Upload rent agreement" onFiles={(files) => onRead(files, "")} />
      </label>
      <Status read={read} onRetry={onRetry} />
      <details className="tips" style={{ margin: 0 }}>
        <summary><Icon name="edit" small />Paste the text instead<Icon name="chevron" small className="chev" /></summary>
        <div style={{ padding: "0 14px 14px", display: "grid", gap: 8 }}>
          <label className="sr" htmlFor="ag-paste">Agreement text</label>
          <textarea id="ag-paste" style={{ minHeight: 160 }} placeholder="Paste the agreement text here" value={pasted} onChange={(e) => setPasted(e.target.value)} />
          <button className="btn small" type="button" disabled={!pasted.trim()} onClick={() => onRead([], pasted)} style={{ justifySelf: "start" }}>
            Read pasted text
          </button>
        </div>
      </details>
      <p className="hint" style={{ display: "flex", gap: 6, alignItems: "flex-start", margin: 0 }}>
        <Icon name="lock" small />
        Saved privately with this flat. Reading runs on Google&apos;s Gemini free tier, which may use what you send to improve Google&apos;s products.
      </p>
    </>
  );
}

function AgreementView({ flat, setFlat, patchFlat, read, onRead, onRetry }: Omit<Props, "onStop" | "onClose">) {
  const toast = useToast();
  const ag = flat.agreement!;
  const f = ag.facts;
  const proposals = ag.reviewed ? [] : agreementProposals(flat, f);
  const [picked, setPicked] = useState<Record<string, boolean>>(() => Object.fromEntries(proposals.map((p) => [p.key, p.on])));
  const [armed, setArmed] = useState(false);

  async function setReviewed() {
    setFlat((x) => (x.agreement ? { ...x, agreement: { ...x.agreement, reviewed: true } } : x));
    const result = await markAgreementReviewed(flat.id);
    if (!result.ok) toast(result.error, "bad");
  }

  function apply() {
    const chosen = proposals.filter((p) => picked[p.key]);
    if (chosen.length) patchFlat(Object.fromEntries(chosen.map((p) => [p.key, p.value])) as FlatPatch, 0);
    void setReviewed();
    toast(chosen.length ? `Updated ${plural(chosen.length, "detail")} from your agreement.` : "Kept your details as they are.");
  }

  async function remove() {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 3500);
      return;
    }
    const result = await removeAgreement(flat.id);
    if (!result.ok) return toast(result.error, "bad");
    setFlat((x) => ({ ...x, agreement: null }));
    toast("Agreement removed.");
  }

  const period = f.start || f.end ? `${f.start ? fmtDate(f.start) : "?"}${f.end ? ` to ${fmtDate(f.end)}` : " onwards"}` : "";
  const facts: [string, string][] = (
    [
      ["Owner", f.owner],
      ["Tenant", f.tenant],
      ["Agreement date", f.agreementDate ? fmtDate(f.agreementDate) : ""],
      ["Agreement period", period],
      ["Monthly rent", f.rent != null ? money(f.rent) : ""],
      ["Security deposit", f.deposit != null ? money(f.deposit) : ""],
      ["Deposit refund", refundText(f.refundDays)],
      ["Lock-in", f.lockIn],
      ["Notice period", f.notice],
      ["Maintenance", f.maintenance],
    ] as [string, string | undefined][]
  ).filter((x): x is [string, string] => Boolean(x[1]));
  const example = flat.isExample && !ag.files.length && !ag.pasted;
  const meta = example
    ? "Example agreement (illustrative)"
    : `Read ${ag.readAt ? fmtDate(ag.readAt, true) : ""}${ag.pages ? ` · ${plural(ag.pages, "page")}` : ""}${ag.pasted ? " · from pasted text" : ""}`;

  return (
    <div className="enter" style={{ display: "grid", gap: 14 }}>
      <p className="agmeta"><Icon name="check" small />{meta}</p>
      <Status read={read} onRetry={onRetry} />

      {proposals.length > 0 && (
        <div className="review">
          <b>Update your flat details from the agreement?</b>
          {proposals.map((p) => (
            <label key={p.key}>
              <input type="checkbox" checked={Boolean(picked[p.key])} onChange={(e) => setPicked((s) => ({ ...s, [p.key]: e.target.checked }))} />
              <span>
                {p.label}: {p.from && <><span className="from">{p.from}</span> → </>}<b>{p.to}</b>
              </span>
            </label>
          ))}
          <div className="actions" style={{ marginTop: 2 }}>
            <button className="btn small accent" type="button" onClick={apply}><Icon name="check" small />Update details</button>
            <button className="btn small ghost" type="button" onClick={() => void setReviewed()}>Not now</button>
          </div>
        </div>
      )}

      {facts.length > 0 && (
        <div className="sec">
          <h3>Key facts</h3>
          <div className="facts">
            {facts.map(([label, value]) => (
              <div key={label}><span>{label}</span><b>{value}</b></div>
            ))}
          </div>
        </div>
      )}

      {ag.flags.length > 0 && (
        <div className="sec">
          <h3>Watch out at move-out</h3>
          {ag.flags.map((x, i) => (
            <div className="flag st" style={{ ["--i" as string]: i }} key={i}><Icon name="alert" small /><span>{x}</span></div>
          ))}
        </div>
      )}

      {ag.clauses.length > 0 && (
        <div className="sec">
          <h3>Clauses that matter</h3>
          {ag.clauses.map((k, i) => (
            <div className="clause st" style={{ ["--i" as string]: i }} key={i}>
              <div className="ct">
                <span className="when">{k.topic}</span>
                {k.clause && <span className="conf">Clause {k.clause}</span>}
              </div>
              {k.plain && <p>{k.plain}</p>}
              {k.quote && <blockquote>“{k.quote}”</blockquote>}
            </div>
          ))}
        </div>
      )}

      {ag.files.length > 0 && (
        <div className="sec">
          <h3>Files</h3>
          {ag.files.map((x) => (
            <a className="agfile" key={x.href} href={x.href} target="_blank" rel="noopener">
              <Icon name={x.contentType === "application/pdf" ? "doc" : "camera"} small />{x.name}
            </a>
          ))}
        </div>
      )}

      <div className="sec">
        <div className="actions" style={{ margin: 0 }}>
          <label className="btn small ghost file-btn">
            <Icon name="doc" small />Replace agreement
            <FileInput label="Replace rent agreement" onFiles={(files) => onRead(files, "")} />
          </label>
          <button className={`btn small ghost danger ${armed ? "armed" : ""}`} type="button" onClick={remove}>
            <Icon name="trash" small />{armed ? "Click again to remove" : "Remove"}
          </button>
        </div>
        <p className="hint" style={{ margin: 0 }}>The AI can misread scans. Check each fact against your agreement before you rely on it.</p>
      </div>
    </div>
  );
}

function FileInput({ label, onFiles }: { label: string; onFiles: (files: File[]) => void }) {
  return (
    <input
      type="file"
      multiple
      accept="application/pdf,image/*"
      aria-label={label}
      onChange={(e) => {
        if (e.target.files?.length) onFiles(Array.from(e.target.files));
        e.target.value = "";
      }}
    />
  );
}

function Status({ read, onRetry }: { read: AgreementReadState; onRetry: () => void }) {
  if (!read.status) return null;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <p className={`status ${read.error ? "err" : ""}`} role="status" style={{ margin: 0 }}>{read.status}</p>
      {read.error && read.canRetry && <button className="btn small ghost" type="button" onClick={onRetry}>Try again</button>}
    </div>
  );
}
