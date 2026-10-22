"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useEffect, useState, useTransition, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { requestWhatsAppCode, signInWithEmail, signUpWithEmail, verifyWhatsAppCode, type AuthFormState } from "./actions";

/** Sign in or sign up. With WhatsApp set up, the mobile number and a code are all it takes; email stays as a fallback. */
export function AuthForm({ mode, whatsapp }: { mode: "sign-in" | "sign-up"; whatsapp: boolean }) {
  const [useEmail, setUseEmail] = useState(!whatsapp);
  const next = useSearchParams().get("next") || "/";
  // Neon Auth's session cookie is always Secure. Safari won't store Secure cookies over plain http,
  // even on localhost, so sign-in would appear to work and then fail. This form only renders in the browser.
  const safariOnHttp =
    typeof window !== "undefined" &&
    window.location.protocol === "http:" &&
    /Safari/.test(navigator.userAgent) &&
    !/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS/.test(navigator.userAgent);

  return (
    <section className="wrap auth">
      <div className="modal auth-card">
        <span className="eyebrow">{mode === "sign-in" ? "Welcome back" : "Create your account"}</span>
        <h1>{mode === "sign-in" ? "Sign in to ProofNest" : "Start protecting your deposit"}</h1>
        <p className="muted">
          {useEmail
            ? "Your flats, photos and letters are private to your account."
            : "No password needed. We send a code to WhatsApp on your number, and a new number gets its account automatically."}
        </p>
        {safariOnHttp && (
          <p className="notice" role="alert">
            Safari can&apos;t keep you signed in on <b>http://</b>localhost. Open this page in Chrome, or run the app with{" "}
            <code>npm run dev:https</code> and use https://localhost:3000.
          </p>
        )}
        {useEmail ? <EmailForm mode={mode} next={next} /> : <WhatsAppForm next={next} />}
        {whatsapp && (
          <button className="linkbtn auth-alt" type="button" onClick={() => setUseEmail((v) => !v)}>
            {useEmail ? "Use your mobile number instead" : "Use email and password instead"}
          </button>
        )}
      </div>
    </section>
  );
}

function WhatsAppForm({ next }: { next: string }) {
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState<{ phone: string; display: string; note?: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [wait, setWait] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!wait) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  function send(e?: FormEvent) {
    e?.preventDefault();
    start(async () => {
      setError("");
      const result = await requestWhatsAppCode(sent?.phone ?? phone);
      if (!result.ok) return setError(result.error);
      setSent(result);
      setCode("");
      setWait(30);
    });
  }

  function verify(value: string) {
    if (!sent || value.length !== 6) return;
    start(async () => {
      setError("");
      const result = await verifyWhatsAppCode(sent.phone, value, next);
      if (result && !result.ok) setError(result.error);
    });
  }

  if (!sent) {
    return (
      <form className="auth-step" onSubmit={send}>
        <div>
          <label className="lab" htmlFor="phone">Mobile number on WhatsApp</label>
          <div className="phone-field">
            {!phone.trim().startsWith("+") && <span>+91</span>}
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={18}
              required
              autoFocus
            />
          </div>
          <p className="hint">Not an Indian number? Type it with + and the country code.</p>
        </div>
        <Consent checked={agreed} onChange={setAgreed} />
        {error && <p className="status err" role="alert">{error}</p>}
        <button className="btn accent big" type="submit" disabled={pending || !phone.trim() || !agreed}>
          <Icon name="chat" small />{pending ? "Sending…" : "Send code on WhatsApp"}
        </button>
      </form>
    );
  }

  return (
    <form
      className="auth-step"
      onSubmit={(e) => {
        e.preventDefault();
        verify(code);
      }}
    >
      <div>
        <label className="lab" htmlFor="code">Code sent to WhatsApp on {sent.display}</label>
        <input
          id="code"
          className="code-input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="••••••"
          value={code}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(value);
            if (value.length === 6) verify(value);
          }}
          autoFocus
          required
        />
        {sent.note && <p className="hint">{sent.note}</p>}
      </div>
      {error && <p className="status err" role="alert">{error}</p>}
      <button className="btn accent big" type="submit" disabled={pending || code.length !== 6}>
        {pending ? "Checking…" : "Verify and continue"}
      </button>
      <p className="muted auth-switch">
        <button className="linkbtn" type="button" disabled={pending || wait > 0} onClick={() => send()}>
          {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
        </button>
        {" · "}
        <button
          className="linkbtn"
          type="button"
          onClick={() => {
            setSent(null);
            setCode("");
            setError("");
          }}
        >
          Change number
        </button>
      </p>
    </form>
  );
}

function EmailForm({ mode, next }: { mode: "sign-in" | "sign-up"; next: string }) {
  const action = mode === "sign-in" ? signInWithEmail : signUpWithEmail;
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, null);
  const other = mode === "sign-in" ? "/auth/sign-up" : "/auth/sign-in";
  return (
    <form action={formAction} className="auth-step">
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
      {mode === "sign-up" && <Consent name="consent" />}
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
  );
}

/** Consent under the DPDP Act: plain words, a link to the full notice, and nothing pre-ticked. */
function Consent({ checked, onChange, name }: { checked?: boolean; onChange?: (v: boolean) => void; name?: string }) {
  return (
    <label className="consent">
      <input
        type="checkbox"
        name={name}
        required
        {...(onChange ? { checked: !!checked, onChange: (e) => onChange(e.target.checked) } : {})}
      />
      <span>
        I agree to the <Link href="/terms" target="_blank">terms</Link>, and that ProofNest keeps my sign-in details, flat details and photos to
        make my record, as the <Link href="/privacy" target="_blank">privacy notice</Link> explains. I can delete everything at any time.
      </span>
    </label>
  );
}
