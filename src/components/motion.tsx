"use client";

import { animate, MotionConfig, motion, useInView, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** One feel for every animation: a calm spring. With "reduce motion" on, everything appears instantly. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 260, damping: 30, mass: 0.9 }}>
      {children}
    </MotionConfig>
  );
}

type RevealProps = HTMLMotionProps<"div"> & { delay?: number; stagger?: number; as?: "div" | "dl" | "ul" };

/** Plays the first time it scrolls into view: its RevealItems rise into place one after another. */
export function Reveal({ children, delay = 0, stagger = 0.07, as = "div", ...rest }: RevealProps) {
  // Same props either way; the element only changes so lists keep their meaning for screen readers.
  const Tag = (as === "dl" ? motion.dl : as === "ul" ? motion.ul : motion.div) as typeof motion.div;
  return (
    <Tag
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      variants={{ hidden: {}, shown: { transition: { delayChildren: delay, staggerChildren: stagger } } }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

const item = { hidden: { opacity: 0, y: 14 }, shown: { opacity: 1, y: 0 } };

/** One part of a Reveal: fades up a little, in turn. */
export function RevealItem({ children, as = "div", ...rest }: HTMLMotionProps<"div"> & { as?: "div" | "li" }) {
  const Tag = (as === "li" ? motion.li : motion.div) as typeof motion.div;
  return (
    <Tag variants={item} {...rest}>
      {children}
    </Tag>
  );
}

/** A rupee amount that counts to its value when it first appears, and glides when it changes. */
export function Rupees({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  // Starts at zero and counts up once visible; screen readers get the real amount from the label throughout.
  const [shown, setShown] = useState(0);
  const from = useRef<number | null>(null);

  useEffect(() => {
    if (!seen) return;
    const start = from.current ?? 0;
    from.current = value;
    if (reduce || start === value) {
      setShown(value);
      return;
    }
    const controls = animate(start, value, { duration: 0.9, ease: [0.2, 0.8, 0.2, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => controls.stop();
  }, [seen, value, reduce]);

  return (
    <span ref={ref} className={className} aria-label={`₹${value.toLocaleString("en-IN")}`}>
      <span aria-hidden="true">₹{shown.toLocaleString("en-IN")}</span>
    </span>
  );
}
