"use client";

import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { recordPhoto, updateFlat } from "@/app/flats/actions";
import { useDialogFocus } from "@/components/useDialogFocus";
import { isMoveOut, nextAction, stepStates, summaryText, totals, withRecordChanged, type NextButton } from "@/lib/guidance";
import { depositMonths, fmtDate, money, plural, refundInfo } from "@/lib/format";
import { flushSaves, scheduleSave, sendOnUnload } from "@/lib/pending-saves";
import { exifDate, safeFileName, sha256Hex, toJpeg, UPLOADABLE } from "@/lib/photo-client";
import { MoveOutStep } from "./MoveOutStep";
import { CONDITIONS, type AgreementDTO, type ChargeDTO, type FlatDTO, type FlatPatch, type PhotoDTO, type PhotoPhase, type Step } from "@/lib/types";
import { pendingKey, proofLine, withRetry } from "@/lib/photo-labels";
import { AgreementDrawer, type AgreementReadState } from "./AgreementDrawer";
import { CameraCapture } from "./CameraCapture";
import { CheckStep, type CheckState } from "./CheckStep";
import { DetailsDrawer } from "./DetailsDrawer";
import { LetterStep } from "./LetterStep";
import { RecordStep } from "./RecordStep";

/** PDFs go to the AI as they are, so they must fit in one request (see AGREEMENT_MAX_BASE64 in lib/ai.ts). */
const MAX_AGREEMENT_PDF_BYTES = 9 * 1024 * 1024;
const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

const STEPS: { id: Step; n: number; when: string; title: string; short: string }[] = [
  { id: "record", n: 1, when: "At move-in", title: "Move-in record", short: "Move-in" },
  { id: "moveout", n: 2, when: "At move-out", title: "Move-out record", short: "Move-out" },
  { id: "check", n: 3, when: "At move-out", title: "Check deductions", short: "Check" },
  { id: "letter", n: 4, when: "At move-out", title: "Refund letter", short: "Letter" },
];

export function FlatWorkspace({ initialFlat, initialStep }: { initialFlat: FlatDTO; initialStep: Step }) {
  const [flat, setFlat] = useState(initialFlat);
  const [step, setStep] = useState<Step>(initialStep);
  const [animKey, setAnimKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [zoom, setZoom] = useState<PhotoDTO | null>(null);
  const [pending, setPending] = useState<Record<string, number>>({});
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [check, setCheck] = useState<CheckState>({ running: false, status: "", error: false, replay: 0 });
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const checkCtl = useRef<AbortController | null>(null);
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [camera, setCamera] = useState<{ room: string; phase: PhotoPhase } | null>(null);
  const closeCamera = useCallback(() => setCamera(null), []);
  const [agRead, setAgRead] = useState<AgreementReadState>({ phase: "idle", status: "", error: false, canRetry: false });
  const agCtl = useRef<AbortController | null>(null);
  const lastAgInput = useRef<{ files: File[]; text: string } | null>(null);
  const toast = useToast();

  const goStep = useCallback(
    (next: Step) => {
      // Clicking the step you're on does nothing, so it never wipes half-typed input or an AI run in progress.
      if (next === step) return;
      setStep(next);
      setAnimKey((k) => k + 1);
      window.history.replaceState(null, "", `?step=${next}`);
    },
    [step],
  );

  /** Saves edits to the flat, keeping the screen in sync first so typing never waits on the network. */
  const patchFlat = useCallback(
    (patch: FlatPatch, delay = 600) => {
      setFlat((f) => ({
        ...f,
        ...patch,
        // Clearing the handover date goes back to moving in, unless move-out work has started (the server agrees).
        stage:
          patch.keysHandedOver || patch.deductionsText
            ? "moveout"
            : "keysHandedOver" in patch && !f.deductionsText.trim() && !f.charges.length
              ? "movein"
              : f.stage,
      }));
      scheduleSave(
        `flat:${flat.id}:${Object.keys(patch).join(",")}`,
        delay,
        async () => {
          try {
            const result = await updateFlat(flat.id, patch);
            if (!result.ok) toast(result.error, "bad");
          } catch {
            toast("Couldn't save that change. Check your connection and try again.", "bad");
          }
        },
        () => sendOnUnload(`/api/flats/${flat.id}/save`, { patch }),
      );
    },
    [flat.id, toast],
  );

  /** Uploads camera photos one at a time so P-numbers follow the order they were taken. */
  const addPhotos = useCallback(
    async (room: string, fileList: FileList | File[], opts: { live?: string; earlier?: boolean; phase?: PhotoPhase } = {}) => {
      const files = Array.from(fileList).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
      if (!files.length) {
        toast("Pick photo files (JPEG, PNG or WebP).", "bad");
        return;
      }
      const phase = opts.phase ?? "movein";
      const home: Step = phase === "moveout" ? "moveout" : "record";
      if (step !== home) goStep(home);
      const key = pendingKey(phase, room);
      setPending((p) => ({ ...p, [key]: (p[key] ?? 0) + files.length }));
      let added = 0;
      const failed: string[] = [];
      for (const file of files) {
        try {
          const buf = await file.arrayBuffer();
          const [hash, takenExif] = [await sha256Hex(buf), exifDate(buf)];
          // Photos are stored as JPEG; gallery photos in other formats are converted first.
          const blob: Blob = file.type === "image/jpeg" && file.size < 19.5 * 1024 * 1024 ? file : await toJpeg(file, 3200);
          // On a weak connection the upload is tried again a few times before the photo counts as failed.
          const uploaded = await withRetry(() =>
            upload(`flats/${flat.id}/photos/${safeFileName(file.name)}.jpg`, blob, {
              access: "private",
              handleUploadUrl: "/api/upload",
              clientPayload: JSON.stringify({ flatId: flat.id, kind: "photo" }),
              contentType: "image/jpeg",
            }),
          );
          const result = await withRetry(() =>
            recordPhoto(flat.id, {
              pathname: uploaded.pathname,
              contentType: uploaded.contentType || "image/jpeg",
              sizeBytes: blob.size,
              room,
              sha256: hash,
              takenAt: opts.live ? Date.now() : (takenExif ?? (file.lastModified || null)),
              takenFrom: opts.live || takenExif ? "camera" : "file",
              ...(opts.live && { capture: "live" as const, dayCode: opts.live }),
              ...(opts.earlier && { earlier: true }),
              phase,
            }),
          );
          if (!result.ok) throw new Error(result.error);
          added++;
          setFreshIds((s) => new Set(s).add(result.data.id));
          setFlat((f) =>
            withRecordChanged(
              phase === "moveout"
                ? { ...f, stage: "moveout", moveOutPhotos: [...f.moveOutPhotos, result.data].sort((a, b) => a.n - b.n) }
                : { ...f, rooms: f.rooms.includes(room) ? f.rooms : [...f.rooms, room], photos: [...f.photos, result.data].sort((a, b) => a.n - b.n) },
              phase,
            ),
          );
        } catch (e) {
          const message = e instanceof Error ? e.message : "";
          // The Blob library reports every upload refusal as "client token", so only name storage when it's really missing.
          failed.push(
            /storage isn't connected|503/i.test(message)
              ? "photo storage isn't connected yet"
              : /convert|decode|bitmap|source image/i.test(message)
                ? `${file.name} isn't a format this browser can read (on iPhone, share it as JPEG)`
                : /client token|failed to fetch|network/i.test(message)
                  ? "the upload didn't go through; check your connection, or sign in again"
                  : message || `${file.name} couldn't be added`,
          );
        } finally {
          setPending((p) => ({ ...p, [key]: Math.max(0, (p[key] ?? 1) - 1) }));
        }
      }
      // One message for the whole batch, so a failure isn't hidden behind the next toast.
      if (failed.length) {
        toast(`${added ? `${plural(added, "photo")} added to ${room}. ` : ""}${plural(failed.length, "photo")} couldn't be added: ${failed[0]}.`, "bad");
      } else if (added && !opts.live) {
        toast(added === 1 ? `Photo added to ${room}.` : `${added} photos added to ${room}.`);
      }
    },
    [flat.id, goStep, step, toast],
  );

  /** Photos come only from ProofNest's live camera, so they can't be gallery images edited or made with AI. */
  const openCamera = useCallback(
    (room: string, phase: PhotoPhase = "movein") => {
      const home: Step = phase === "moveout" ? "moveout" : "record";
      if (step !== home) goStep(home);
      setCamera({ room, phase });
    },
    [goStep, step],
  );

  const copySummary = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(summaryText(flat));
      toast("Message copied. Paste it into WhatsApp or email to your owner.");
    } catch {
      toast("Copy didn't work here. Select the text and copy it yourself.", "bad");
    }
  }, [flat, toast]);

  /** Sends the owner's deductions (and an optional screenshot) to the AI through the check route. */
  const runCheck = useCallback(async () => {
    if (check.running) return;
    if (!flat.deductionsText.trim() && !screenshot) {
      toast("Paste the owner's deductions first, or add a screenshot of them.", "bad");
      if (step !== "check") goStep("check");
      return;
    }
    if (step !== "check") goStep("check");
    checkCtl.current = new AbortController();
    setCheck((c) => ({ ...c, running: true, status: "", error: false }));
    try {
      const form = new FormData();
      form.set("deductions", flat.deductionsText);
      if (screenshot) {
        const small = /^image\/(jpeg|png|webp)$/.test(screenshot.type) && screenshot.size < 3_000_000 ? screenshot : await toJpeg(screenshot, 2000, 0.85);
        form.set("screenshot", small, "screenshot.jpg");
      }
      const res = await fetch(`/api/flats/${flat.id}/check`, { method: "POST", body: form, signal: checkCtl.current.signal });
      const json = (await res.json().catch(() => null)) as { ok: boolean; charges?: ChargeDTO[]; analyzedAt?: string; error?: string } | null;
      if (!json?.ok || !json.charges) {
        setCheck((c) => ({ ...c, running: false, error: true, status: json?.error || "Something went wrong. Try again." }));
        return;
      }
      const charges = json.charges;
      const dispute = totals(charges).dispute;
      setFlat((f) => ({ ...f, stage: "moveout", charges, analyzedAt: json.analyzedAt ?? new Date().toISOString() }));
      setCheck((c) => ({
        running: false,
        error: false,
        replay: c.replay + 1,
        status: dispute ? `Done. You can dispute ${money(dispute)}. Review each card and set your decision.` : "Done. Review each card and set your decision.",
      }));
    } catch (e) {
      const stopped = e instanceof DOMException && e.name === "AbortError";
      setCheck((c) => ({ ...c, running: false, error: !stopped, status: stopped ? "Stopped." : "Couldn't reach ProofNest. Check your connection." }));
    } finally {
      checkCtl.current = null;
    }
  }, [check.running, flat.deductionsText, flat.id, goStep, screenshot, step, toast]);

  /** Uploads the agreement's files to private storage, then has the AI read them through the agreement route. */
  const readAgreement = useCallback(
    async (picked: File[], text: string) => {
      if (agCtl.current) return;
      const files = picked
        .filter((f) => isPdf(f) || f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      const fail = (status: string, canRetry = false) => setAgRead({ phase: "idle", status, error: true, canRetry });
      if (picked.length && !files.length) return fail("Pick a PDF, or photos of the agreement's pages.");
      if (!files.length && !text.trim()) return;
      if (files.length > 15) return fail("Upload at most 15 files: a PDF, or one photo per page.");
      const pdfBytes = files.filter(isPdf).reduce((n, f) => n + f.size, 0);
      if (pdfBytes > MAX_AGREEMENT_PDF_BYTES) {
        return fail(`That PDF is ${(pdfBytes / 1024 / 1024).toFixed(1)} MB. ProofNest reads PDFs up to 9 MB. Upload photos of the pages instead.`);
      }

      lastAgInput.current = { files, text };
      const ctl = new AbortController();
      agCtl.current = ctl;
      try {
        const uploaded = [];
        for (const [i, file] of files.entries()) {
          setAgRead({ phase: "uploading", status: files.length > 1 ? `Uploading file ${i + 1} of ${files.length}…` : "Uploading your agreement…", error: false, canRetry: false });
          const pdf = isPdf(file);
          const blob: Blob = pdf || (UPLOADABLE.test(file.type) && file.size < 8 * 1024 * 1024) ? file : await toJpeg(file, 2400, 0.85);
          const contentType = pdf ? "application/pdf" : blob.type || "image/jpeg";
          const ext = pdf ? "pdf" : contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
          const result = await upload(`flats/${flat.id}/agreement/${safeFileName(file.name)}.${ext}`, blob, {
            access: "private",
            handleUploadUrl: "/api/upload",
            clientPayload: JSON.stringify({ flatId: flat.id, kind: "agreement" }),
            contentType,
            abortSignal: ctl.signal,
          });
          uploaded.push({ pathname: result.pathname, name: file.name.slice(0, 80), contentType, sizeBytes: blob.size });
        }
        setAgRead({ phase: "reading", status: "", error: false, canRetry: false });
        const res = await fetch(`/api/flats/${flat.id}/agreement`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ files: uploaded, text }),
          signal: ctl.signal,
        });
        const json = (await res.json().catch(() => null)) as { ok: boolean; agreement?: AgreementDTO; error?: string; code?: string } | null;
        if (!json?.ok || !json.agreement) return fail(json?.error || "Something went wrong. Try again.", json?.code !== "not_agreement" && json?.code !== "too_large");
        const agreement = json.agreement;
        setFlat((f) => ({ ...f, agreement }));
        setAgRead({ phase: "idle", status: "", error: false, canRetry: false });
        toast("Agreement read. Check what the AI found.");
      } catch (e) {
        // Stopping mid-upload throws the Blob library's own abort error, not a DOMException.
        const stopped = ctl.signal.aborted || (e instanceof DOMException && e.name === "AbortError");
        const message = e instanceof Error ? e.message : "";
        if (stopped) setAgRead({ phase: "idle", status: "Stopped.", error: false, canRetry: false });
        else if (/storage isn't connected|503|client token/i.test(message)) fail("File storage isn't connected yet, so the agreement can't be saved.");
        else fail("Couldn't reach ProofNest. Check your connection.", true);
      } finally {
        agCtl.current = null;
      }
    },
    [flat.id, toast],
  );

  const copyLetter = useCallback(async () => {
    if (!flat.letter.trim()) {
      toast("Write or build the letter first.", "bad");
      goStep("letter");
      return;
    }
    try {
      await navigator.clipboard.writeText(flat.letter);
      toast("Letter copied. Paste it into WhatsApp or email.");
    } catch {
      toast("Copy didn't work here. Select the text and copy it yourself.", "bad");
    }
  }, [flat.letter, goStep, toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setZoom(null);
        setDrawerOpen(false);
        setAgreementOpen(false);
      }
    };
    // A photo dropped outside a room would otherwise make the browser open the file and leave the app.
    const keepFiles = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    // Send edits still waiting to save when the tab is hidden or closed, rather than losing them.
    const onHide = () => {
      if (document.visibilityState === "hidden") flushSaves();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushSaves);
    window.addEventListener("keydown", onKey);
    window.addEventListener("dragover", keepFiles);
    window.addEventListener("drop", keepFiles);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushSaves);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("dragover", keepFiles);
      window.removeEventListener("drop", keepFiles);
    };
  }, []);

  return (
    <div className="wrap case">
      <CaseHead flat={flat} reading={agRead.phase !== "idle"} onEdit={() => setDrawerOpen(true)} onAgreement={() => setAgreementOpen(true)} />
      <NextCard
        flat={flat}
        step={step}
        onStep={goStep}
        onCamera={openCamera}
        onCopy={copySummary}
        onRunCheck={runCheck}
        onCopyLetter={copyLetter}
        onOwner={(phase) => {
          const home: Step = phase === "moveout" ? "moveout" : "record";
          if (step !== home) goStep(home);
          setTimeout(() => document.getElementById(phase === "moveout" ? "owner-confirm-moveout" : "owner-confirm")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
        }}
        running={check.running}
      />
      <div className="folder">
      <Stepper flat={flat} step={step} onStep={goStep} />
      <section className="panel enter" key={animKey} role="region" aria-label={STEPS.find((s) => s.id === step)?.title}>
        {step === "record" && (
          <RecordStep
            flat={flat}
            setFlat={setFlat}
            pending={pending}
            freshIds={freshIds}
            onCamera={openCamera}
            onEarlier={(room, files) => addPhotos(room, files, { earlier: true })}
            onZoom={setZoom}
            onCopy={copySummary}
            patchFlat={patchFlat}
          />
        )}
        {step === "moveout" && (
          <MoveOutStep
            flat={flat}
            setFlat={setFlat}
            pending={pending}
            freshIds={freshIds}
            onCamera={(room) => openCamera(room, "moveout")}
            onZoom={setZoom}
            patchFlat={patchFlat}
            onStep={goStep}
          />
        )}
        {step === "check" && (
          <CheckStep
            flat={flat}
            setFlat={setFlat}
            patchFlat={patchFlat}
            check={check}
            screenshot={screenshot}
            setScreenshot={setScreenshot}
            onRun={runCheck}
            onStop={() => checkCtl.current?.abort()}
            onZoom={setZoom}
            onGoRecord={() => goStep("record")}
            onOpenAgreement={() => setAgreementOpen(true)}
          />
        )}
        {step === "letter" && <LetterStep flat={flat} setFlat={setFlat} patchFlat={patchFlat} onStep={goStep} onCopy={copyLetter} />}
      </section>
      </div>
      {drawerOpen && <DetailsDrawer flat={flat} setFlat={setFlat} patchFlat={patchFlat} onClose={() => setDrawerOpen(false)} />}
      {camera && (
        <CameraCapture
          room={camera.room}
          label={camera.phase === "moveout" ? `${camera.room} · move-out` : camera.room}
          code={flat.dayCode}
          onShot={(file) => addPhotos(camera.room, [file], { live: flat.dayCode, phase: camera.phase })}
          onClose={closeCamera}
        />
      )}
      {agreementOpen && (
        <AgreementDrawer
          flat={flat}
          setFlat={setFlat}
          patchFlat={patchFlat}
          read={agRead}
          onRead={readAgreement}
          onRetry={() => lastAgInput.current && readAgreement(lastAgInput.current.files, lastAgInput.current.text)}
          onStop={() => agCtl.current?.abort()}
          onClose={() => setAgreementOpen(false)}
        />
      )}
      {zoom && <Lightbox photo={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

function CaseHead({ flat, reading, onEdit, onAgreement }: { flat: FlatDTO; reading: boolean; onEdit: () => void; onAgreement: () => void }) {
  const refund = refundInfo(flat.keysHandedOver, flat.refundDays);
  const meta = [
    flat.ownerName && `Owner: ${flat.ownerName}`,
    flat.moveIn && `Moved in ${fmtDate(flat.moveIn)}`,
    flat.keysHandedOver && `Keys handed over ${fmtDate(flat.keysHandedOver)}`,
  ].filter(Boolean);
  const months = depositMonths(flat.monthlyRent, flat.deposit);
  const answer = flat.ownerAnswer;
  const asked = flat.ownerReview?.status === "pending";
  let refundStat = null;
  if (refund) {
    const cls = refund.left < 0 ? "late" : refund.left <= 5 ? "soon" : "ok";
    const text = refund.left < 0 ? `Overdue by ${plural(-refund.left, "day")}` : refund.left === 0 ? "Due today" : `${plural(refund.left, "day")} left`;
    refundStat = (
      <div className={cls}>
        <dt>Refund due</dt>
        <dd>{fmtDate(refund.due)}<small>{text}</small></dd>
      </div>
    );
  } else if (isMoveOut(flat)) {
    refundStat = (
      <div>
        <dt>Refund due</dt>
        <dd><button className="linkbtn" type="button" onClick={onEdit}>Add the date</button></dd>
      </div>
    );
  }
  return (
    <section className="casehead enter">
      <div className="ch-top">
        <div className="ch-main">
          <h1 className="ch-title">{flat.address}{flat.isExample && <span className="tag">Example</span>}</h1>
          <p className="ch-meta">{meta.length ? meta.join(" · ") : "Add the owner and dates in Edit details."}</p>
        </div>
        <button className="btn ghost small" type="button" onClick={onEdit}>
          <Icon name="edit" small />Edit details
        </button>
      </div>
      <dl className="stats">
        {flat.deposit && Number(flat.deposit) > 0 && (
          <div>
            <dt>Security deposit</dt>
            <dd>{money(flat.deposit)}{months && <small>{months}</small>}</dd>
          </div>
        )}
        {refundStat}
        {(answer || asked) && (
          <div className={answer?.status === "confirmed" ? "ok" : answer?.status === "disputed" ? "soon" : ""}>
            <dt>Owner</dt>
            <dd>
              {answer ? (answer.status === "confirmed" ? "Confirmed" : "Disagreed") : "Asked to confirm"}
              <small>{answer?.respondedAt ? fmtDate(answer.respondedAt) : "Waiting"}</small>
            </dd>
          </div>
        )}
        <div>
          <dt>Rent agreement</dt>
          <dd>
            <button className="linkbtn" type="button" onClick={onAgreement}>
              {reading ? "Reading…" : flat.agreement ? `Read · ${plural(flat.agreement.clauses.length, "clause")}` : "Add agreement"}
            </button>
          </dd>
        </div>
      </dl>
    </section>
  );
}

function Stepper({ flat, step, onStep }: { flat: FlatDTO; step: Step; onStep: (s: Step) => void }) {
  const states = stepStates(flat);
  return (
    <nav className="stepper" aria-label="Steps">
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
            <b><span className="long">{s.title}</span><span className="short">{s.short}</span></b>
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
  onCamera,
  onCopy,
  onRunCheck,
  onCopyLetter,
  onOwner,
  running,
}: {
  flat: FlatDTO;
  step: Step;
  onStep: (s: Step) => void;
  onCamera: (room: string, phase?: PhotoPhase) => void;
  onCopy: () => void;
  onRunCheck: () => void;
  onCopyLetter: () => void;
  onOwner: (phase: PhotoPhase) => void;
  running: boolean;
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
    if (b.kind === "run-check") {
      return (
        <button className={`btn small ${cls}`} type="button" onClick={onRunCheck} disabled={running}>
          {running ? "Checking…" : b.label}
        </button>
      );
    }
    if (b.kind === "copy-letter") {
      return (
        <button className={`btn small ${cls}`} type="button" onClick={onCopyLetter}>
          <Icon name="copy" small />{b.label}
        </button>
      );
    }
    if (b.kind === "owner") {
      return (
        <button className={`btn small ${cls}`} type="button" onClick={() => onOwner(b.phase ?? "movein")}>
          <Icon name="chat" small />{b.label}
        </button>
      );
    }
    if (b.kind === "link") {
      return (
        <Link className={`btn small ${cls}`} href={b.href}>
          <Icon name={b.icon} small />{b.label}
        </Link>
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
      <button className={`btn small ${cls}`} type="button" onClick={() => onCamera(b.room, b.phase)}>
        <Icon name="camera" small />{b.label}
      </button>
    );
  };
  return (
    <section className="next enter" key={action.key} aria-label="What to do next">
      <div>
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

function Lightbox({ photo, onClose }: { photo: PhotoDTO; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useDialogFocus(box);
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="lightbox" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="lb-in" ref={box} role="dialog" aria-modal="true" aria-label={`Photo P${photo.n}`}>
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
                {!photo.isExample && <><br />{proofLine(photo)}</>}
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
