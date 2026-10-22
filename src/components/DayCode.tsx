"use client";

import { useEffect, useState } from "react";
import SplitFlapText from "@/components/kokonutui/split-flap-text";

/** Today's day code on a little departure board: the tiles flip from blank to the code when the page opens. */
export function DayCode({ code }: { code: string }) {
  const [text, setText] = useState("    ");
  useEffect(() => {
    const t = setTimeout(() => setText(code), 250);
    return () => clearTimeout(t);
  }, [code]);
  return (
    <span className="kk daycode-board" title={`Today's code: ${code}`}>
      <SplitFlapText text={text} length={4} className="text-[1.375rem] sm:text-[1.5rem] font-mono font-bold" tileClassName="bg-primary text-primary-foreground" />
    </span>
  );
}
