"use client";

import { useState, useTransition } from "react";
import { joinFlat } from "@/app/flats/members";

export function JoinForm({ token, defaultName }: { token: string; defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <form
      className="join-form"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        start(async () => {
          const result = await joinFlat(token, name);
          if (result && !result.ok) setError(result.error);
        });
      }}
    >
      <label className="lab" htmlFor="join-name">Your name</label>
      <input id="join-name" type="text" value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} />
      <button className="btn accent" type="submit" disabled={pending || name.trim().length < 2}>{pending ? "Joining…" : "Join this flat"}</button>
      {error && <p className="status err" role="alert">{error}</p>}
    </form>
  );
}
