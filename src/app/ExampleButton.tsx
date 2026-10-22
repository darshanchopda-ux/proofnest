"use client";

import { useFormStatus } from "react-dom";

/** Submits the "make an example flat" form once, and says it's working while the flat is created. */
export function ExampleButton() {
  const { pending } = useFormStatus();
  return (
    <button className="linkbtn" type="submit" disabled={pending}>
      {pending ? "Opening the example flat…" : "Or look through an example flat"}
    </button>
  );
}
