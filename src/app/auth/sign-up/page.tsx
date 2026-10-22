import type { Metadata } from "next";
import { Suspense } from "react";
import { FreshOnNavigate } from "@/components/FreshOnNavigate";
import { whatsappConfigured } from "@/lib/whatsapp";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = { title: "Create account · ProofNest" };

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="wrap loading"><i />Opening…</div>}>
      <FreshOnNavigate>
        <AuthForm mode="sign-up" whatsapp={whatsappConfigured() || process.env.NODE_ENV === "development"} />
      </FreshOnNavigate>
    </Suspense>
  );
}
