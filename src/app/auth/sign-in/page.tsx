import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = { title: "Sign in · ProofNest" };

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="wrap loading"><i />Opening…</div>}>
      <AuthForm mode="sign-in" />
    </Suspense>
  );
}
