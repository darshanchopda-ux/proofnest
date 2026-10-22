"use client";

import { motion } from "motion/react";
import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Rupees } from "@/components/motion";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { addCharge, deleteCharge, flagCharge, setChargeDecision } from "@/app/flats/actions";
import { totals } from "@/lib/guidance";
import { fmtDate, money, plural } from "@/lib/format";
import { AI_LABEL, DECISIONS, type ChargeDTO, type Decision, type FlatDTO, type FlatPatch, type PhotoDTO } from "@/lib/types";

const MESSAGES = [
  "Reading the owner's deductions…",
  "Looking at your move-in photos…",
  "Matching each charge to your evidence…",
  "Separating damage from normal wear and tear…",
  "Writing up a verdict for each charge…",
];

export type CheckState = { running: boolean; status: string; error: boolean; replay: number };

type Props = {
  flat: FlatDTO;
  setFlat: Dispatch<SetStateAction<FlatDTO>>;
  patchFlat: (patch: FlatPatch, delay?: number) => void;
  check: CheckState;
  screenshot: File | null;
  setScreenshot: (file: File | null) => void;
  onRun: () => void;
  onStop: () => void;
  onZoom: (photo: PhotoDTO) => void;
  onGoRecord: () => void;
  onOpenAgreement: () => void;
};

export function CheckStep({ flat, setFlat, patchFlat, check, screenshot, setScreenshot, onRun, onStop, onZoom, onGoRecord, onOpenAgreement }: Props) {
  const toast = useToast();
  const [msg, setMsg] = useState(0);
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!check.running) return;
    const id = setInterval(() => setMsg((m) => (m + 1) % MESSAGES.length), 2600);
    return () => clearInterval(id);
  }, [check.running]);

  const photoByN = new Map([...flat.photos, ...flat.moveOutPhotos].map((p) => [p.n, p]));
  const real = flat.photos.filter((p) => p.src);
  const noted = flat.photos.filter((p) => p.note).length;
  const t = totals(flat.charges);

  async function decide(c: ChargeDTO, decision: Decision) {
    const before = c.decision;
    const put = (d: Decision) => setFlat((f) => ({ ...f, charges: f.charges.map((x) => (x.id === c.id ? { ...x, decision: d } : x)) }));
    put(decision);
    let error = "";
    try {
      const result = await setChargeDecision(flat.id, c.id, decision);
      if (!result.ok) error = result.error;
    } catch {
      error = "Couldn't save your decision. Check your connection and try again.";
    }
    if (error) {
      put(before);
      toast(error, "bad");
    }
  }

  async function flag(c: ChargeDTO, flagged: boolean) {
    const put = (v: boolean) => setFlat((f) => ({ ...f, charges: f.charges.map((x) => (x.id === c.id ? { ...x, aiFlagged: v } : x)) }));
    put(flagged);
    try {
      const result = await flagCharge(flat.id, c.id, flagged);
      if (!result.ok) throw new Error(result.error);
    } catch (e) {
      put(!flagged);
      toast(e instanceof Error && e.message ? e.message : "Couldn't save that. Check your connection and try again.", "bad");
    }
  }

  /** Returns false when the charge couldn't be deleted, so its row can come back. */
  async function remove(c: ChargeDTO): Promise<boolean> {
    try {
      const result = await deleteCharge(flat.id, c.id);
      if (!result.ok) {
        toast(result.error, "bad");
        return false;
      }
    } catch {
      toast("Couldn't remove the charge. Check your connection and try again.", "bad");
      return false;
    }
    setFlat((f) => ({ ...f, charges: f.charges.filter((x) => x.id !== c.id) }));
    return true;
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!item.trim() || adding) return;
    setAdding(true);
    try {
      const result = await addCharge(flat.id, item, Number(amount));
      if (!result.ok) return toast(result.error, "bad");
      setFlat((f) => ({ ...f, stage: "moveout", charges: [...f.charges, result.data] }));
      setFresh(result.data.id);
      setItem("");
      setAmount("");
    } catch {
      toast("Couldn't add the charge. Check your connection and try again.", "bad");
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <div className="panel-head">
        <div>
          <div className="ttl"><h2>Check deductions</h2></div>
          <p>Paste the owner&apos;s message. AI checks each charge against your move-in record; you decide what to dispute.</p>
        </div>
      </div>

      <div className="two">
        <div className="subcard">
          <div className="mini">What the owner wants to deduct</div>
          <label className="sr" htmlFor="f-deductions">Owner&apos;s deductions</label>
          <textarea
            id="f-deductions"
            maxLength={8000}
            value={flat.deductionsText}
            onChange={(e) => patchFlat({ deductionsText: e.target.value })}
            placeholder={"Painting charges  ₹18,000\nDeep cleaning  ₹4,500\nKitchen tile repair  ₹6,000"}
          />
          <div className="shot">
            {screenshot ? (
              <>
                <span className="chip manual">{screenshot.name || "Screenshot"}</span>
                <button className="btn small ghost" type="button" onClick={() => setScreenshot(null)}>Remove</button>
              </>
            ) : (
              <label className="btn small ghost file-btn">
                <Icon name="camera" small />Add a screenshot
                <input
                  type="file"
                  accept="image/*"
                  aria-label="Screenshot of the owner's deductions"
                  onChange={(e) => {
                    setScreenshot(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        </div>

        <div className="subcard">
          <div className="mini">Evidence the AI will use</div>
          {real.length > 0 && (
            <div className="thumbs">
              {real.slice(0, 8).map((p) => (
                <button key={p.id} type="button" className="thumb" onClick={() => onZoom(p)}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked image route */}
                  <img src={`${p.src}?w=160`} alt="" loading="lazy" />
                  <small>P{p.n} · {p.room}</small>
                </button>
              ))}
            </div>
          )}
          <dl className="evlist">
            <div><dt>Move-in photos</dt><dd>{flat.photos.length}{real.length ? ", up to 8 shown to the AI" : ""}</dd></div>
            <div><dt>Photo notes</dt><dd>{noted}</dd></div>
            <div><dt>Other evidence</dt><dd>{flat.evidenceNotes.trim() ? "WhatsApp and emails you noted" : "None yet"}</dd></div>
            <div>
              <dt>Rent agreement</dt>
              <dd>
                {flat.agreement ? (
                  plural(flat.agreement.clauses.length, "clause")
                ) : (
                  <button className="linkbtn" type="button" onClick={onOpenAgreement} style={{ fontSize: "inherit", padding: 0 }}>Add it</button>
                )}
              </dd>
            </div>
          </dl>
          <button className="linkbtn" type="button" onClick={onGoRecord} style={{ justifySelf: "start", fontSize: ".84rem" }}>
            Improve your record <Icon name="arrow" small />
          </button>
        </div>
      </div>

      <div className="cta">
        <button className="btn big accent" type="button" onClick={onRun} disabled={check.running}>
          {flat.charges.some((c) => c.source === "ai") ? "Check again with AI" : "Check with AI"}
        </button>
        {check.running && <button className="btn ghost" type="button" onClick={onStop}>Stop</button>}
        <span className={`status ${check.error ? "err" : check.status.startsWith("Done") ? "good" : ""}`} role="status" aria-live="polite">
          {check.status || (flat.analyzedAt && !check.running ? `Last checked ${fmtDate(flat.analyzedAt, true)}.` : "")}
        </span>
      </div>
      <p className="hint" style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <Icon name="lock" small />
        Checks run on Google&apos;s Gemini free tier, which may use what you send, including photos, to improve Google&apos;s products.
      </p>

      {check.running ? (
        <div className="progress-card">
          <div className="pbar"><i /></div>
          <p className="pmsg"><span key={msg}>{MESSAGES[msg]}</span></p>
          {[0, 1, 2].map((k) => (
            <div className="skrow" key={k}><span className="skel w60" /><span className="skel w30" /><span className="skel w90" /></div>
          ))}
        </div>
      ) : flat.charges.length ? (
        <div className={check.replay ? "enter" : ""} key={check.replay}>
          <div className="summary">
            <div><span>Charged</span><b><Rupees value={t.all} /></b></div>
            <div className="s-ok"><span>Disputing</span><b><Rupees value={t.dispute} /></b></div>
            <div className="s-check"><span>Ask to explain</span><b><Rupees value={t.check} /></b></div>
            <div><span>Accepting</span><b><Rupees value={t.accept} /></b></div>
          </div>
          <div className="rows">
            {flat.charges.map((c, i) => (
              <ChargeRow key={c.id} charge={c} index={i} fresh={fresh === c.id} photoByN={photoByN} onDecide={decide} onFlag={flag} onRemove={remove} onZoom={onZoom} />
            ))}
          </div>
        </div>
      ) : (
        <div className="empty" style={{ marginTop: 20 }}>
          <b>Your verdicts appear here</b>
          <span>One card per charge, with the photos it relies on and a choice of what to do.</span>
        </div>
      )}

      <form className="addcharge" onSubmit={add}>
        <label className="sr" htmlFor="ac-item">Charge</label>
        <input id="ac-item" type="text" placeholder="Add a charge by hand, e.g. Sofa cleaning" maxLength={160} value={item} onChange={(e) => setItem(e.target.value)} />
        <label className="sr" htmlFor="ac-amt">Amount in rupees</label>
        <input id="ac-amt" type="number" placeholder="Amount (₹)" min={0} step={1} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button className="btn small ghost" type="submit" disabled={adding}><Icon name="plus" small />{adding ? "Adding…" : "Add charge"}</button>
      </form>
    </>
  );
}

function ChargeRow({
  charge: c,
  index,
  fresh,
  photoByN,
  onDecide,
  onFlag,
  onRemove,
  onZoom,
}: {
  charge: ChargeDTO;
  index: number;
  fresh: boolean;
  photoByN: Map<number, PhotoDTO>;
  onDecide: (c: ChargeDTO, d: Decision) => void;
  onFlag: (c: ChargeDTO, flagged: boolean) => void;
  onRemove: (c: ChargeDTO) => Promise<boolean>;
  onZoom: (p: PhotoDTO) => void;
}) {
  const [armed, setArmed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const low = c.confidence != null && c.confidence < 0.8 && c.aiVerdict !== "check";
  return (
    <motion.div
      layout="position"
      className={`row d-${c.decision} ${leaving ? "leaving" : ""}`}
      // Rows arrive one after another when the AI check finishes; a charge added by hand slides in on its own.
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: { delay: fresh ? 0 : Math.min(index, 8) * 0.06 } }}
    >
      <div className="row-top">
        <span className="row-item">{c.item}</span>
        <span className="row-amt">{money(c.amount)}</span>
      </div>
      <div className="row-meta">
        {c.aiVerdict ? (
          <>
            <span className={`chip vstamp ${c.aiVerdict}`} style={{ ["--i" as string]: index }}>{AI_LABEL[c.aiVerdict]}</span>
            {c.confidence != null && <span className="conf">AI, {Math.round(c.confidence * 100)}% sure</span>}
            {low && <span className="chip check">Check this</span>}
          </>
        ) : (
          <span className="chip manual">Added by you</span>
        )}
        {c.photoNs.map((n) => {
          const p = photoByN.get(n);
          return p ? <button key={n} type="button" className="pref" onClick={() => onZoom(p)}>P{n}</button> : null;
        })}
      </div>
      {c.reason && <p className={`row-reason ${c.aiFlagged ? "flagged" : ""}`}>{c.reason}</p>}
      {c.aiVerdict && (
        <p className="row-flag">
          {c.aiFlagged ? (
            <>
              You said the AI got this wrong. Only your decision counts, and its reason stays out of your letter.{" "}
              <button className="linkbtn" type="button" onClick={() => onFlag(c, false)}>Undo</button>
            </>
          ) : (
            <button className="linkbtn" type="button" onClick={() => onFlag(c, true)}>The AI got this wrong</button>
          )}
        </p>
      )}
      <div className="row-decide">
        <label htmlFor={`vd-${c.id}`}>Your decision</label>
        <select id={`vd-${c.id}`} value={c.decision} onChange={(e) => onDecide(c, e.target.value as Decision)}>
          {(Object.keys(DECISIONS) as Decision[]).map((d) => <option key={d} value={d}>{DECISIONS[d]}</option>)}
        </select>
        <button
          className={`iconbtn ${armed ? "armed" : ""}`}
          type="button"
          aria-label={armed ? "Confirm removing this charge" : "Remove charge"}
          onClick={() => {
            if (!armed) {
              setArmed(true);
              setTimeout(() => setArmed(false), 3500);
              return;
            }
            setLeaving(true);
            setTimeout(async () => {
              if (!(await onRemove(c))) setLeaving(false);
            }, 200);
          }}
        >
          {armed ? "Sure?" : <Icon name="trash" small />}
        </button>
      </div>
    </motion.div>
  );
}
