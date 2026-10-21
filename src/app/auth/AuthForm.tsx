"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { signInWithEmail, signUpWithEmail, type AuthFormState } from "./actions";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const action = mode === "sign-in" ? signInWithEmail : signUpWithEmail;
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, null);
  const next = useSearchParams().get("next") || "/";

  const other = mode === "sign-in" ? "/auth/sign-up" : "/auth/sign-in";

  return (
    <section className="wrap auth">
      <form action={formAction} className="modal auth-card">
        <span className="eyebrow">{mode === "sign-in" ? "Welcome back" : "Create your account"}</span>
        <h1>{mode === "sign-in" ? "Sign in to ProofNest" : "Start protecting your deposit"}</h1>
        <p className="muted">Your flats, photos and letters are private to your account.</p>
        <input type="hidden" name="next" value={next} />
        {mode === "sign-up" && (
          <div>
            <label className="lab" htmlFor="name">Your name</label>
            <input id="name" name="name" type="text" autoComplete="name" required />
          </div>
        )}
        <div>
          <label className="lab" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="lab" htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            minLength={mode === "sign-up" ? 8 : undefined}
            required
          />
          {mode === "sign-up" && <p className="hint">At least 8 characters.</p>}
        </div>
        {state?.error && <p className="status err" role="alert">{state.error}</p>}
        <button className="btn accent big" type="submit" disabled={pending}>
          {pending ? "One moment…" : mode === "sign-in" ? "Sign in" : "Create account"}
        </button>
        <p className="muted auth-switch">
          {mode === "sign-in" ? "New to ProofNest? " : "Already have an account? "}
          <Link href={next === "/" ? other : `${other}?next=${encodeURIComponent(next)}`}>
            {mode === "sign-in" ? "Create an account" : "Sign in"}
          </Link>
        </p>
      </form>
    </section>
  );
}
