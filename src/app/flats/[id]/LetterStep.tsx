"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { refundAsk, totals } from "@/lib/guidance";
import { money } from "@/lib/format";
import { templateLetter } from "@/lib/letter-template";
import type { FlatDTO, FlatPatch, Step } from "@/lib/types";

type Props = {
  flat: FlatDTO;
  patchFlat: (patch: FlatPatch, delay?: number) => void;
  onStep: (s: Step) => void;
  onCopy: () => void;
};

export function LetterStep({ flat, patchFlat, onStep, onCopy }: Props) {
  const toast = useToast();
  const [writing, setWriting] = useState(false);
  const [status, setStatus] = useState<{ text: string; kind: "" | "good" | "err" }>({ text: "", kind: "" });
  const [armed, setArmed] = useState<"" | "ai" | "template">("");
  const [replay, setReplay] = useState(1);
  const ctl = useRef<AbortController | null>(null);

  if (!flat.charges.length) {
    return (
      <>
        <Head />
        <div className="empty">
          <b>Check the deductions first</b>
          <span>Your letter is built from what you decide about each charge in step 2.</span>
          <button className="btn small" type="button" onClick={() => onStep("check")}>Go to step 2 <Icon name="arrow" small /></button>
        </div>
      </>
    );
  }

  const t = totals(flat.charges);
  const deposit = Number(flat.deposit) || 0;
  const ask = refundAsk(flat);
  const hasLetter = flat.letter.trim().length > 0;

  /** Asks for a second click before replacing a letter the tenant may have edited. */
  function confirmReplace(kind: "ai" | "template"): boolean {
    if (!hasLetter || armed === kind) {
      setArmed("");
      return true;
    }
    setArmed(kind);
    setTimeout(() => setArmed(""), 3500);
    return false;
  }

  async function writeWithAI() {
    if (!confirmReplace("ai")) return;
    ctl.current = new AbortController();
    setWriting(true);
    setStatus({ text: "AI is writing your letter…", kind: "" });
    try {
      const res = await fetch(`/api/flats/${flat.id}/letter`, { method: "POST", signal: ctl.current.signal });
      const json = (await res.json().catch(() => null)) as { ok: boolean; letter?: string; truncated?: boolean; error?: string } | null;
      if (!json?.ok || !json.letter) {
        setStatus({ text: json?.error || "Something went wrong. Try again, or use Build from template.", kind: "err" });
        return;
      }
      patchFlat({ letter: json.letter }, 0);
      setReplay((r) => r + 1);
      setStatus(
        json.truncated
          ? { text: "The letter was cut short. Edit the ending before sending.", kind: "err" }
          : { text: "Done. Read it through and edit before you send it.", kind: "good" },
      );
    } catch (e) {
      setStatus({ text: e instanceof DOMException && e.name === "AbortError" ? "Stopped." : "Couldn't reach ProofNest. Check your connection.", kind: "" });
    } finally {
      setWriting(false);
      ctl.current = null;
    }
  }

  function buildTemplate() {
    if (!confirmReplace("template")) return;
    patchFlat({ letter: templateLetter(flat) }, 0);
    setReplay((r) => r + 1);
    setStatus({ text: "Built from your decisions. Edit it before you send it.", kind: "good" });
  }

  function download() {
    if (!hasLetter) return toast("Write or build the letter first.", "bad");
    const url = URL.createObjectURL(new Blob([flat.letter], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Deposit refund letter - ${flat.address.replace(/[^\w\- ,.]+/g, "").slice(0, 60) || "flat"}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <Head />
      {ask != null ? (
        <div className="askcard">
          <span>You&apos;re asking for</span>
          <b>{money(ask)}</b>
          <small>
            Deposit {money(deposit)}
            {t.accept ? ` minus ${money(t.accept)} you accept` : ", nothing accepted"}
            {t.check ? `. ${money(t.check)} is waiting on the owner's explanation.` : "."}
          </small>
        </div>
      ) : (
        <div className="notice" style={{ marginBottom: 16 }}>Add your security deposit in Edit details to see exactly how much to ask for.</div>
      )}

      <div className="actions" style={{ margin: "0 0 12px" }}>
        <button className={`btn accent ${armed === "ai" ? "armed" : ""}`} type="button" onClick={writeWithAI} disabled={writing}>
          {armed === "ai" ? "Replace current letter?" : "Write with AI"}
        </button>
        <button className={`btn ghost ${armed === "template" ? "armed" : ""}`} type="button" onClick={buildTemplate} disabled={writing}>
          <Icon name="doc" small />{armed === "template" ? "Replace current letter?" : "Build from template"}
        </button>
        {writing && <button className="btn ghost" type="button" onClick={() => ctl.current?.abort()}>Stop</button>}
        <span className={`status ${status.kind}`} role="status" aria-live="polite">{status.text}</span>
      </div>

      <div className={`paper ${writing ? "streaming" : ""}`}>
        {writing && <span className="paper-badge"><i />AI is writing</span>}
        <label className="sr" htmlFor="f-letter">Letter</label>
        <textarea
          id="f-letter"
          key={replay}
          value={flat.letter}
          onChange={(e) => patchFlat({ letter: e.target.value })}
          placeholder="Choose Write with AI or Build from template. Your letter appears here."
          readOnly={writing}
        />
      </div>

      <div className="actions">
        <button className="btn small" type="button" onClick={onCopy} disabled={!hasLetter}><Icon name="copy" small />Copy letter</button>
        <button className="btn small ghost" type="button" onClick={download} disabled={!hasLetter}><Icon name="download" small />Download .txt</button>
      </div>
      <p className="hint" style={{ marginTop: 12 }}>
        Legal information, not legal advice. Check it against your rent agreement before you send it on WhatsApp or email. ProofNest never
        sends anything to your owner. Write with AI uses Google&apos;s Gemini free tier, which may use what you send to improve Google&apos;s products.
      </p>
    </>
  );
}

function Head() {
  return (
    <div className="panel-head">
      <div>
        <div className="ttl"><h2>Refund letter</h2></div>
        <p>Built from your decisions and photo numbers. Edit it freely; it saves as you type.</p>
      </div>
    </div>
  );
}
