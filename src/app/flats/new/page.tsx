import type { Metadata } from "next";
import { Suspense } from "react";
import { NewFlatWizard } from "./NewFlatWizard";

export const metadata: Metadata = { title: "Add a flat · ProofNest" };

export default function NewFlatPage() {
  return (
    <section className="wrap auth">
      <Suspense fallback={<div className="loading"><i />Opening…</div>}>
        <NewFlatWizard />
      </Suspense>
    </section>
  );
}
