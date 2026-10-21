"use client";

import { useEffect, useRef, useState } from "react";
import { money } from "@/lib/format";

/** Shows a rupee amount, counting up from zero whenever `replay` changes. Respects reduced motion. */
export function CountUp({ value, replay }: { value: number; replay: number }) {
  const [shown, setShown] = useState(value);
  const last = useRef(replay);

  useEffect(() => {
    const animate = replay !== last.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    last.current = replay;
    let frame = 0;
    if (!animate) {
      frame = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(frame);
    }
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 750);
      setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, replay]);

  return <>{money(shown)}</>;
}
