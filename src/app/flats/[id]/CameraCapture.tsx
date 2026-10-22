"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
import { useDialogFocus } from "@/components/useDialogFocus";
import { fmtIST, plural } from "@/lib/format";

type Props = {
  room: string;
  /** What the stamp and heading call this set of photos, e.g. "Kitchen · move-out". */
  label?: string;
  /** Today's code for this flat, printed on every photo taken here. */
  code: string;
  onShot: (file: File) => void;
  onClose: () => void;
};

/**
 * ProofNest's own camera screen. Photos come straight from the camera, never from the gallery, and each one has
 * the room, the time in IST and the day's code printed along the bottom, so an image made earlier can't pass as one.
 */
export function CameraCapture({ room, label = room, code, onShot, onClose }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [taken, setTaken] = useState(0);
  const [flash, setFlash] = useState(false);
  const [torch, setTorch] = useState<"none" | "off" | "on">("none");
  const [dark, setDark] = useState(false);
  useDialogFocus(box);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser can't open the camera. Open ProofNest on your phone to take the photos.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1920 } },
          audio: false,
        });
        // Closed while the camera was starting: switch it off again rather than leave it running.
        if (cancelled || !video.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.current.srcObject = stream;
        await video.current.play();
        track.current = stream.getVideoTracks()[0] ?? null;
        // Phones that have a torch say so in the track's capabilities; most laptops don't.
        const caps = track.current?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
        if (caps?.torch) setTorch("off");
        setReady(true);
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Camera access was refused. Allow the camera for this site in your browser settings, then reopen the camera."
            : "The camera couldn't start. Close other apps using it, or open ProofNest on your phone.",
        );
      }
    };
    void start();
    // Every second, check how bright the picture is, so a photo too dark to show damage gets a warning first.
    const probe = document.createElement("canvas");
    probe.width = 32;
    probe.height = 24;
    const light = window.setInterval(() => {
      const v = video.current;
      const ctx = probe.getContext("2d", { willReadFrequently: true });
      if (!v || !v.videoWidth || !ctx) return;
      ctx.drawImage(v, 0, 0, 32, 24);
      const px = ctx.getImageData(0, 0, 32, 24).data;
      let sum = 0;
      for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      setDark(sum / (px.length / 4) < 45);
    }, 1000);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      window.clearInterval(light);
      stream?.getTracks().forEach((t) => t.stop());
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function toggleTorch() {
    const next = torch === "on" ? "off" : "on";
    try {
      await track.current?.applyConstraints({ advanced: [{ torch: next === "on" } as MediaTrackConstraintSet] });
      setTorch(next);
    } catch {
      setTorch("none");
    }
  }

  function shoot() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const w = v.videoWidth;
    const h = v.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);
    // The stamp is part of the image itself, so it survives sharing, printing and WhatsApp compression.
    const band = Math.max(30, Math.round(h * 0.05));
    ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
    ctx.fillRect(0, h - band, w, band);
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 ${Math.round(band * 0.46)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.textBaseline = "middle";
    const now = Date.now();
    ctx.fillText(`ProofNest · ${label} · ${fmtIST(now)} · Code ${code}`, Math.round(band * 0.4), h - band / 2, w - band * 0.8);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onShot(new File([blob], `${room.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${now}.jpg`, { type: "image/jpeg", lastModified: now }));
        setTaken((t) => t + 1);
        setFlash(true);
        setTimeout(() => setFlash(false), 160);
      },
      "image/jpeg",
      0.9,
    );
  }

  // Rendered at the top of the page, so the step panel's fade-in can't stack it under the app bar.
  return createPortal(
    <>
      <div className="overlay" />
      <div className="camera" ref={box} role="dialog" aria-modal="true" aria-label={`Take photos of the ${label}`}>
        <div className="cam-top">
          <div>
            <b>{label}</b>
            <span>Today&apos;s code <code>{code}</code> is printed on every photo</span>
          </div>
          <button className="iconbtn" type="button" onClick={onClose} aria-label="Close the camera"><Icon name="close" small /></button>
        </div>
        <div className={`cam-view ${flash ? "flash" : ""}`}>
          {error ? <p className="cam-msg">{error}</p> : <video ref={video} playsInline muted />}
          {!ready && !error && <p className="cam-msg">Starting the camera…</p>}
          {ready && dark && (
            <p className="cam-dark" role="status">
              Too dark to show damage clearly. Switch on the lights{torch !== "none" ? " or the torch" : ""}, or open the curtains.
            </p>
          )}
          {torch !== "none" && (
            <button className="cam-torch" type="button" onClick={toggleTorch} aria-pressed={torch === "on"}>
              {torch === "on" ? "Torch on" : "Torch"}
            </button>
          )}
        </div>
        <div className="cam-bar">
          <span>{taken ? `${plural(taken, "photo")} taken and saving` : "Stand in a corner so each photo shows two walls and the floor."}</span>
          <button className="shutter" type="button" onClick={shoot} disabled={!ready} aria-label="Take photo" />
          <button className="btn small" type="button" onClick={onClose}>Done</button>
        </div>
      </div>
    </>,
    document.body,
  );
}
