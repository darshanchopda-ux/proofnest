"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The landing board in 3D. The server renders the flat polaroid board (fast, readable, works without JavaScript);
 * this then loads Three.js, paints each print into a texture straight from that board, and lays real 3D prints over
 * the flat ones in exactly the same place. They drop in, breathe, and tilt a little towards the pointer.
 * Skipped entirely for reduced motion, no WebGL, or a phone that's saving data.
 */
export function HeroBoard3D({ children }: { children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = host.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (reduce || saveData || !webglAvailable()) return;

    let stop = () => {};
    let cancelled = false;
    let three: Three | null = null;
    const start = async () => {
      stop();
      stop = () => {};
      three ??= (await Promise.all([import("three"), document.fonts?.ready]))[0];
      if (cancelled) return;
      stop = await mount(three, root);
    };
    start().catch((e) => console.warn("3D board unavailable, keeping the flat one", e));
    // The prints are placed to match the flat board, so a new layout needs a fresh scene.
    let width = root.clientWidth;
    let timer = 0;
    const ro = new ResizeObserver(() => {
      if (Math.abs(root.clientWidth - width) < 2) return;
      width = root.clientWidth;
      clearTimeout(timer);
      timer = window.setTimeout(() => start().catch(() => {}), 200);
    });
    ro.observe(root);
    return () => {
      cancelled = true;
      ro.disconnect();
      clearTimeout(timer);
      stop();
    };
  }, []);

  return (
    <div ref={host} className="board3d">
      {children}
    </div>
  );
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

type Three = typeof import("three");

async function mount(THREE: Three, root: HTMLElement): Promise<() => void> {
  const prints = Array.from(root.querySelectorAll<HTMLElement>(".bprint"));
  if (!prints.length) return () => {};
  const box = root.getBoundingClientRect();
  const W = box.width;
  const H = box.height;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(dpr);
  renderer.setSize(W, H);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.className = "board3d-canvas";
  canvas.setAttribute("aria-hidden", "true");

  // A perspective camera placed so that the z = 0 plane maps 1:1 onto CSS pixels: the 3D prints land exactly on the flat ones.
  const fov = 30;
  const dist = H / 2 / Math.tan((fov * Math.PI) / 360);
  const camera = new THREE.PerspectiveCamera(fov, W / H, 1, dist * 3);
  camera.position.set(0, 0, dist);
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  scene.add(group);

  const shadowTex = new THREE.CanvasTexture(shadowCanvas());
  const items = await Promise.all(
    prints.map(async (el, i) => {
      // The flat prints are rotated a little, so take their size unrotated and only their centre from the screen.
      const rect = el.getBoundingClientRect();
      const r = { width: el.offsetWidth, height: el.offsetHeight, left: rect.left + rect.width / 2 - el.offsetWidth / 2, top: rect.top + rect.height / 2 - el.offsetHeight / 2 };
      const tilt = parseFloat(getComputedStyle(el).getPropertyValue("--tilt")) || 0;
      const tex = new THREE.CanvasTexture(await paintPrint(el, r.width, r.height));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const card = new THREE.Mesh(new THREE.PlaneGeometry(r.width, r.height), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(r.width * 1.25, r.height * 1.25),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.55 }),
      );
      const tape = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(76, r.width * 0.36), 22), new THREE.MeshBasicMaterial({ color: 0xd99a1e, transparent: true, opacity: 0.45 }));
      const pivot = new THREE.Group();
      pivot.add(shadow, card, tape);
      tape.position.set(0, r.height / 2 + 1, 2);
      tape.rotation.z = -0.05;
      // CSS pixels from the board's top-left to world units around its centre.
      const x = r.left - box.left + r.width / 2 - W / 2;
      const y = -(r.top - box.top + r.height / 2 - H / 2);
      pivot.position.set(x, y, 0);
      group.add(pivot);
      return { pivot, card, shadow, home: { x, y, rz: (-tilt * Math.PI) / 180 }, delay: i * 0.14, phase: i * 1.7, lift: 0 };
    }),
  );

  // One render before swapping in: a browser that won't upload these textures throws here and keeps the flat board.
  try {
    renderer.render(scene, camera);
  } catch (e) {
    renderer.dispose();
    throw e;
  }
  root.appendChild(canvas);
  root.classList.add("is-3d");

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e: PointerEvent) => {
    const b = root.getBoundingClientRect();
    pointer.tx = ((e.clientX - b.left) / b.width - 0.5) * 2;
    pointer.ty = ((e.clientY - b.top) / b.height - 0.5) * 2;
  };
  const onLeave = () => {
    pointer.tx = 0;
    pointer.ty = 0;
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  root.addEventListener("pointerleave", onLeave);

  // Hovering a print lifts it and straightens it, like picking it up off the board.
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = -1;
  const onHover = (e: PointerEvent) => {
    const b = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(items.map((it) => it.card))[0];
    hovered = hit ? items.findIndex((it) => it.card === hit.object) : -1;
  };
  root.addEventListener("pointermove", onHover, { passive: true });

  let visible = true;
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) loop();
  });
  io.observe(root);

  const start = performance.now();
  let raf = 0;
  // If the browser isn't giving animation frames (low-power mode, a crawler, a paused tab), the prints would hang
  // invisible mid-drop; after a second on screen without frames, step aside and let the flat board show.
  let frames = 0;
  let watchdog = 0;
  let gaveUp = false;
  const watch = () => {
    if (watchdog || gaveUp) return;
    const at = frames;
    watchdog = window.setTimeout(() => {
      if (frames - at < 3) {
        gaveUp = true;
        cleanup();
      }
    }, 1000);
  };
  const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
  function loop() {
    cancelAnimationFrame(raf);
    if (!visible || document.hidden) return;
    const t = (performance.now() - start) / 1000;
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    group.rotation.y = pointer.x * 0.1;
    group.rotation.x = pointer.y * 0.07;
    items.forEach((it, i) => {
      const k = ease((t - 0.15 - it.delay) / 0.95);
      it.lift += ((hovered === i ? 1 : 0) - it.lift) * 0.12;
      const breathe = Math.sin(t * 1.05 + it.phase);
      const z = (1 - k) * 260 + it.lift * 34 + breathe * 3;
      it.pivot.position.set(it.home.x, it.home.y + (1 - k) * 26, z);
      it.pivot.rotation.z = it.home.rz * (1 - it.lift) + (1 - k) * 0.12 * (i % 2 ? 1 : -1) + breathe * 0.004;
      it.pivot.rotation.x = (1 - k) * -0.5;
      (it.card.material as import("three").MeshBasicMaterial).opacity = k;
      // The shadow stays on the board while the print rises, so it spreads and drifts as height grows.
      const h = z / 60;
      it.shadow.position.set(6 + h * 6, -10 - h * 8, -z - 1 + 0.5);
      it.shadow.scale.setScalar(1 + h * 0.08);
      (it.shadow.material as import("three").MeshBasicMaterial).opacity = 0.5 * k * (1 - Math.min(0.5, h * 0.12));
    });
    renderer.render(scene, camera);
    frames++;
    watch();
    raf = requestAnimationFrame(loop);
  }
  const onVis = () => !document.hidden && loop();
  document.addEventListener("visibilitychange", onVis);
  loop();

  let disposed = false;
  function cleanup() {
    if (disposed) return;
    disposed = true;
    clearTimeout(watchdog);
    cancelAnimationFrame(raf);
    io.disconnect();
    window.removeEventListener("pointermove", onMove);
    root.removeEventListener("pointerleave", onLeave);
    root.removeEventListener("pointermove", onHover);
    document.removeEventListener("visibilitychange", onVis);
    root.classList.remove("is-3d");
    canvas.remove();
    scene.traverse((o) => {
      const m = o as import("three").Mesh;
      m.geometry?.dispose();
      const mat = m.material as import("three").MeshBasicMaterial | undefined;
      mat?.map?.dispose();
      mat?.dispose();
    });
    renderer.dispose();
  }
  return cleanup;
}

/** A soft, offset shadow for under a print. */
function shadowCanvas(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 18, 64, 64, 64);
  grad.addColorStop(0, "rgba(30,27,46,0.55)");
  grad.addColorStop(1, "rgba(30,27,46,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return c;
}

/** Paints one print (frame, photo, timestamp band, caption) from the flat board's markup into a canvas. */
async function paintPrint(el: HTMLElement, w: number, h: number): Promise<HTMLCanvasElement> {
  const scale = 2;
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const g = c.getContext("2d")!;
  g.scale(scale, scale);
  const css = getComputedStyle(document.documentElement);
  const sheet = css.getPropertyValue("--sheet").trim() || "#FFFDF8";
  const ink = css.getPropertyValue("--ink").trim() || "#1E1B2E";
  const muted = css.getPropertyValue("--muted").trim() || "#625D52";
  const font = getComputedStyle(el).fontFamily;
  const mono = css.getPropertyValue("--mono").trim() || "monospace";

  g.fillStyle = sheet;
  roundRect(g, 0, 0, w, h, 3);
  g.fill();

  const img = el.querySelector<HTMLElement>(".bimg");
  const svg = img?.querySelector("svg");
  if (img && svg) {
    // Offsets, not screen rects: the print is rotated on screen but painted straight.
    const r = { width: img.offsetWidth, height: img.offsetHeight };
    const x = img.offsetLeft;
    const y = img.offsetTop;
    const pic = await svgImage(svg, r.width, r.height);
    g.drawImage(pic, x, y, r.width, r.height);
    const band = img.querySelector(".ex-band")?.textContent ?? "";
    const bh = Math.max(14, r.height * 0.1);
    g.fillStyle = "rgba(0,0,0,0.55)";
    g.fillRect(x, y + r.height - bh, r.width, bh);
    g.fillStyle = "#fff";
    g.font = `600 ${Math.round(bh * 0.5)}px ${mono}`;
    g.textBaseline = "middle";
    g.fillText(band, x + 6, y + r.height - bh / 2, r.width - 12);

    // Caption: "P1 Kitchen" on the left, the condition tag on the right, the note beneath.
    const cap = el.querySelector("figcaption");
    const top = y + r.height + 10;
    const label = cap?.querySelector("span")?.textContent?.trim() ?? "";
    const cond = cap?.querySelector(".cond");
    const note = cap?.querySelector("small")?.textContent ?? "";
    const size = parseFloat(getComputedStyle(cap ?? el).fontSize) || 15;
    g.textBaseline = "top";
    g.fillStyle = ink;
    g.font = `800 ${size}px ${font}`;
    g.fillText(label, x + 2, top);
    if (cond) {
      const cs = getComputedStyle(cond);
      g.font = `700 ${size * 0.8}px ${font}`;
      const text = cond.textContent ?? "";
      const tw = g.measureText(text).width + 16;
      const tx = x + r.width - tw - 2;
      g.fillStyle = cs.backgroundColor;
      roundRect(g, tx, top - 1, tw, size * 1.3, size * 0.65);
      g.fill();
      g.fillStyle = cs.color;
      g.fillText(text, tx + 8, top + size * 0.12);
    }
    if (note && getComputedStyle(cap?.querySelector("small") ?? el).display !== "none") {
      g.fillStyle = muted;
      g.font = `500 ${size * 0.86}px ${font}`;
      g.fillText(note, x + 2, top + size * 1.55, r.width - 4);
    }
  }
  return c;
}

function svgImage(svg: SVGElement, w: number, h: number): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(Math.round(w * 2)));
  clone.setAttribute("height", String(Math.round(h * 2)));
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
