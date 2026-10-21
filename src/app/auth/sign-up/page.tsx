import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = { title: "Create account · ProofNest" };

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="wrap loading"><i />Opening…</div>}>
      <AuthForm mode="sign-up" />
    </Suspense>
  );
}
