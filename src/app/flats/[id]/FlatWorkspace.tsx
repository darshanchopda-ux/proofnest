"use client";

import { upload } from "@vercel/blob/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { recordPhoto, updateFlat } from "@/app/flats/actions";
import { coverage, isMoveOut, nextAction, stepStates, summaryText, type NextButton } from "@/lib/guidance";
import { depositMonths, fmtDate, money, plural, refundInfo } from "@/lib/format";
import { exifDate, safeFileName, sha256Hex, toJpeg, UPLOADABLE } from "@/lib/photo-client";
import { CONDITIONS, type FlatDTO, type FlatPatch, type PhotoDTO, type Step } from "@/lib/types";
import { DetailsDrawer } from "./DetailsDrawer";
import { RecordStep } from "./RecordStep";

const STEPS: { id: Step; n: number; when: string; title: string }[] = [
  { id: "record", n: 1, when: "At move-in", title: "Move-in record" },
  { id: "check", n: 2, when: "At move-out", title: "Check deductions" },
  { id: "letter", n: 3, when: "At move-out", title: "Refund letter" },
];

export function FlatWorkspace({ initialFlat, initialStep }: { initialFlat: FlatDTO; initialStep: Step }) {
  const [flat, setFlat] = useState(initialFlat);
  const [step, setStep] = useState<Step>(initialStep);
  const [animKey, setAnimKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [zoom, setZoom] = useState<PhotoDTO | null>(null);
  const [pending, setPending] = useState<Record<string, number>>({});
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const toast = useToast();

  const goStep = useCallback((next: Step) => {
    setStep(next);
    setAnimKey((k) => k + 1);
    window.history.replaceState(null, "", `?step=${next}`);
  }, []);

  /** Saves edits to the flat, keeping the screen in sync first so typing never waits on the network. */
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const patchFlat = useCallback(
    (patch: FlatPatch, delay = 600) => {
      setFlat((f) => ({ ...f, ...patch, stage: patch.keysHandedOver || patch.deductionsText ? "moveout" : f.stage }));
      const key = Object.keys(patch).join(",");
      clearTimeout(saveTimers.current[key]);
      saveTimers.current[key] = setTimeout(async () => {
        const result = await updateFlat(flat.id, patch);
        if (!result.ok) toast(result.error, "bad");
      }, delay);
    },
    [flat.id, toast],
  );

  /** Uploads photos one at a time so P-numbers follow the order they were picked. */
  const addPhotos = useCallback(
    async (room: string, fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
      if (!files.length) {
        toast("Pick photo files (JPEG, PNG or WebP).", "bad");
        return;
      }
      if (step !== "record") goStep("record");
      setPending((p) => ({ ...p, [room]: (p[room] ?? 0) + files.length }));
      let added = 0;
      for (const file of files) {
        try {
          const buf = await file.arrayBuffer();
          const [hash, takenExif] = [await sha256Hex(buf), exifDate(buf)];
          const blob: Blob = UPLOADABLE.test(file.type) && file.size < 19.5 * 1024 * 1024 ? file : await toJpeg(file, 3200);
          const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
          const uploaded = await upload(`flats/${flat.id}/photos/${safeFileName(file.name)}.${ext}`, blob, {
            access: "private",
            handleUploadUrl: "/api/upload",
            clientPayload: JSON.stringify({ flatId: flat.id, kind: "photo" }),
            contentType: blob.type || "image/jpeg",
          });
          const result = await recordPhoto(flat.id, {
            pathname: uploaded.pathname,
            contentType: uploaded.contentType || blob.type || "image/jpeg",
            sizeBytes: blob.size,
            room,
            sha256: hash,
            takenAt: takenExif ?? (file.lastModified || null),
            takenFrom: takenExif ? "camera" : "file",
          });
          if (!result.ok) throw new Error(result.error);
          added++;
          setFreshIds((s) => new Set(s).add(result.data.id));
          setFlat((f) => ({
            ...f,
            rooms: f.rooms.includes(room) ? f.rooms : [...f.rooms, room],
            photos: [...f.photos, result.data].sort((a, b) => a.n - b.n),
          }));
        } catch (e) {
          const message = e instanceof Error ? e.message : "";
          toast(
            /storage isn't connected|503|client token/i.test(message)
              ? "Photo storage isn't connected yet, so photos can't be saved."
              : `Couldn't add ${file.name}. ${message}`.trim(),
            "bad",
          );
        } finally {
          setPending((p) => ({ ...p, [room]: Math.max(0, (p[room] ?? 1) - 1) }));
        }
      }
      if (added) toast(added === 1 ? `Photo added to ${room}.` : `${added} photos added to ${room}.`);
    },
    [flat.id, goStep, step, toast],
  );

  const copySummary = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(summaryText(flat));
      toast("Message copied. Paste it into WhatsApp or email to your owner.");
    } catch {
      toast("Copy didn't work here. Select the text and copy it yourself.", "bad");
    }
  }, [flat, toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setZoom(null);
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="wrap case">
      <CaseHead flat={flat} onEdit={() => setDrawerOpen(true)} />
      <Stepper flat={flat} step={step} onStep={goStep} />
      <NextCard flat={flat} step={step} onStep={goStep} onFiles={addPhotos} onCopy={copySummary} />
      <section className="panel enter" key={animKey} role="region" aria-label={STEPS.find((s) => s.id === step)?.title}>
        {step === "record" && (
          <RecordStep
            flat={flat}
            setFlat={setFlat}
            pending={pending}
            freshIds={freshIds}
            onFiles={addPhotos}
            onZoom={setZoom}
            onCopy={copySummary}
            patchFlat={patchFlat}
          />
        )}
        {step === "check" && <CheckPlaceholder flat={flat} patchFlat={patchFlat} />}
        {step === "letter" && <LetterPlaceholder onStep={goStep} />}
      </section>
      {drawerOpen && <DetailsDrawer flat={flat} patchFlat={patchFlat} onClose={() => setDrawerOpen(false)} />}
      {zoom && <Lightbox photo={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

function CaseHead({ flat, onEdit }: { flat: FlatDTO; onEdit: () => void }) {
  const refund = refundInfo(flat.keysHandedOver, flat.refundDays);
  const meta = [
    flat.ownerName && `Owner: ${flat.ownerName}`,
    flat.moveIn && `Moved in ${fmtDate(flat.moveIn)}`,
    flat.keysHandedOver && `Keys handed over ${fmtDate(flat.keysHandedOver)}`,
  ].filter(Boolean);
  const months = depositMonths(flat.monthlyRent, flat.deposit);
  let refundBox = null;
  if (refund) {
    const cls = refund.left < 0 ? "late" : refund.left <= 5 ? "soon" : "ok";
    const text = refund.left < 0 ? `Overdue by ${plural(-refund.left, "day")}` : refund.left === 0 ? "Due today" : `${plural(refund.left, "day")} left`;
    refundBox = (
      <div className={`kv ${cls}`}>
        <span>Refund due</span>
        <b>{fmtDate(refund.due)}</b>
        <small><i className="dotp" />{text}</small>
      </div>
    );
  } else if (isMoveOut(flat)) {
    refundBox = (
      <button className="kv kv-btn" type="button" onClick={onEdit}>
        <span>Refund due</span>
        <small><Icon name="plus" small />Add date</small>
      </button>
    );
  }
  return (
    <section className="casehead enter">
      <div className="ch-main">
        <div className="ch-eyebrow">
          <span className="eyebrow">{isMoveOut(flat) ? "Moving out" : "Moving in"}</span>
          {flat.isExample && <span className="tag">Example</span>}
        </div>
        <h1 className="ch-title">{flat.address}</h1>
        <p className="ch-meta">{meta.length ? meta.join(" · ") : "Add the owner and dates in Edit details."}</p>
      </div>
      <div className="ch-side">
        {flat.deposit && Number(flat.deposit) > 0 && (
          <div className="kv">
            <span>Security deposit</span>
            <b>{money(flat.deposit)}</b>
            {months && <small>{months}</small>}
          </div>
        )}
        {refundBox}
        <button className="btn ghost small ch-edit" type="button" onClick={onEdit}>
          <Icon name="edit" small />Edit details
        </button>
      </div>
    </section>
  );
}

function Stepper({ flat, step, onStep }: { flat: FlatDTO; step: Step; onStep: (s: Step) => void }) {
  const states = stepStates(flat);
  const cov = coverage(flat);
  const [fill, setFill] = useState(0);
  const target = states.letter === "done" ? 100 : states.check === "done" ? 75 : states.record === "done" ? 50 : states.record === "partial" ? 25 : 0;
  useEffect(() => {
    const id = requestAnimationFrame(() => setFill(target));
    return () => cancelAnimationFrame(id);
  }, [target]);
  const subs: Record<Step, string> = {
    record: `${plural(flat.photos.length, "photo")} · ${cov.covered}/${cov.total} rooms`,
    check: flat.chargeCount ? `${plural(flat.chargeCount, "charge")} checked` : flat.deductionsText.trim() ? "Owner's list saved" : "Owner's list",
    letter: states.letter === "done" ? "Draft saved" : "Not started",
  };
  return (
    <nav className="stepper" aria-label="Steps">
      <div className="track" aria-hidden="true"><b style={{ width: `${fill}%` }} /></div>
      {STEPS.map((s) => (
        <button
          key={s.id}
          type="button"
          className={`stp s-${states[s.id]}`}
          aria-current={step === s.id ? "step" : undefined}
          onClick={() => onStep(s.id)}
        >
          <span className="dot">{states[s.id] === "done" ? <Icon name="check" /> : s.n}</span>
          <span className="stx">
            <small>{s.when}</small>
            <b>{s.title}</b>
            <em>{subs[s.id]}</em>
          </span>
        </button>
      ))}
    </nav>
  );
}

function NextCard({
  flat,
  step,
  onStep,
  onFiles,
  onCopy,
}: {
  flat: FlatDTO;
  step: Step;
  onStep: (s: Step) => void;
  onFiles: (room: string, files: FileList) => void;
  onCopy: () => void;
}) {
  const action = nextAction(flat);
  const button = (b: NextButton | undefined, cls: string) => {
    if (!b) return null;
    if (b.kind === "step") {
      if (b.step === step) return null;
      return (
        <button className={`btn small ${cls}`} type="button" onClick={() => onStep(b.step)}>
          {b.label}{b.icon && <Icon name={b.icon} small />}
        </button>
      );
    }
    if (b.kind === "copy-summary") {
      return (
        <button className={`btn small ${cls}`} type="button" onClick={onCopy}>
          <Icon name="copy" small />{b.label}
        </button>
      );
    }
    return (
      <label className={`btn small file-btn ${cls}`}>
        <Icon name="camera" small />{b.label}
        <input
          type="file"
          accept="image/*"
          multiple
          aria-label={b.label}
          onChange={(e) => {
            if (e.target.files) onFiles(b.room, e.target.files);
            e.target.value = "";
          }}
        />
      </label>
    );
  };
  return (
    <section className="next enter" key={action.key} aria-label="What to do next">
      <span className="nic"><Icon name={action.icon} /></span>
      <div>
        <small>What to do next</small>
        <b>{action.title}</b>
        <p>{action.text}</p>
      </div>
      <div className="nbtns">
        {button(action.secondary, "ghost")}
        {button(action.primary, "accent")}
      </div>
    </section>
  );
}

function CheckPlaceholder({ flat, patchFlat }: { flat: FlatDTO; patchFlat: (p: FlatPatch, delay?: number) => void }) {
  return (
    <>
      <div className="panel-head">
        <div>
          <div className="ttl"><h2>Check deductions</h2><span className="when">At move-out</span></div>
          <p>Paste the deductions your owner sent on WhatsApp, SMS or email. It&apos;s saved with your move-in photos.</p>
        </div>
      </div>
      <label className="lab" htmlFor="f-deductions">Owner&apos;s deductions</label>
      <textarea
        id="f-deductions"
        style={{ minHeight: 200 }}
        value={flat.deductionsText}
        onChange={(e) => patchFlat({ deductionsText: e.target.value })}
        placeholder={"Painting charges  ₹18,000\nDeep cleaning  ₹4,500\nKitchen tile repair  ₹6,000"}
      />
      <div className="empty" style={{ marginTop: 18 }}>
        <span className="eic"><Icon name="sparkle" /></span>
        <b>Claude&apos;s charge-by-charge check is coming in the next update</b>
        <span>It will label every charge as already there, wear and tear, no bill or likely valid, using your photos and notes.</span>
      </div>
    </>
  );
}

function LetterPlaceholder({ onStep }: { onStep: (s: Step) => void }) {
  return (
    <>
      <div className="panel-head">
        <div>
          <div className="ttl"><h2>Refund letter</h2><span className="when">At move-out</span></div>
          <p>A polite, firm letter in rupees that cites your photo numbers and asks for the balance by bank transfer or UPI.</p>
        </div>
      </div>
      <div className="empty">
        <span className="eic"><Icon name="doc" /></span>
        <b>The letter is built from your decisions in step 2</b>
        <span>It arrives together with Claude&apos;s deduction check.</span>
        <button className="btn small" type="button" onClick={() => onStep("check")}>Go to step 2 <Icon name="arrow" small /></button>
      </div>
    </>
  );
}

function Lightbox({ photo, onClose }: { photo: PhotoDTO; onClose: () => void }) {
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="lightbox" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="lb-in" role="dialog" aria-modal="true" aria-label={`Photo P${photo.n}`}>
          {photo.src ? (
            // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked image route
            <img src={photo.src} alt={`Photo P${photo.n}, ${photo.room}`} />
          ) : (
            <div className="empty" style={{ margin: 16 }}>Example photo: {photo.note}</div>
          )}
          <div className="lb-cap">
            <div>
              <span className="ptag">P{photo.n}</span> {photo.room} · {CONDITIONS[photo.condition]}
              {photo.note ? ` · ${photo.note}` : ""}
              <div className="pmeta" style={{ marginTop: 4 }}>
                {photo.takenAt && `${photo.takenFrom === "camera" ? "Taken" : "File date"} ${fmtDate(photo.takenAt, true)}`}
                {photo.sha256 && <><br />SHA-256 {photo.sha256}</>}
              </div>
            </div>
            <button className="btn small" type="button" onClick={onClose} autoFocus>Close</button>
          </div>
        </div>
      </div>
    </>
  );
}
