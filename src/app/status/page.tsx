import type { Metadata } from "next";
import { and, gt, sql } from "drizzle-orm";
import { connection } from "next/server";
import { Suspense } from "react";
import { db } from "@/db";
import { aiRuns } from "@/db/schema";
import { n8nConfigured } from "@/lib/n8n";
import { whatsappConfigured } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Status · ProofNest", description: "Whether ProofNest's sign-in, storage and AI are working right now." };

export default function StatusPage() {
  return (
    <div className="wrap narrow">
      <p className="eyebrow">Service status</p>
      <h1 style={{ fontSize: "1.6rem", margin: "4px 0 16px" }}>Is ProofNest working?</h1>
      <Suspense fallback={<p className="muted">Checking…</p>}>
        <Checks />
      </Suspense>
    </div>
  );
}

async function Checks() {
  await connection();
  let database = true;
  let ai = { total: 0, failed: 0, busy: 0 };
  try {
    const [row] = await db
      .select({
        total: sql<number>`count(*)::int`,
        failed: sql<number>`count(*) filter (where ${aiRuns.status} = 'error')::int`,
        busy: sql<number>`count(*) filter (where ${aiRuns.error} ilike '%busy%' or ${aiRuns.error} ilike '%quota%' or ${aiRuns.error} ilike '%429%')::int`,
      })
      .from(aiRuns)
      .where(and(gt(aiRuns.createdAt, sql`now() - interval '24 hours'`)));
    ai = row ?? ai;
  } catch {
    database = false;
  }
  const aiState = !n8nConfigured() ? "off" : ai.total >= 3 && ai.failed / ai.total > 0.5 ? "down" : ai.busy > 0 ? "slow" : "ok";
  const rows: [string, "ok" | "slow" | "down" | "off", string][] = [
    ["Your flats and photos", database ? "ok" : "down", database ? "Saving and loading normally." : "The database isn't answering. Your data is safe; try again in a few minutes."],
    ["Sign in with WhatsApp", whatsappConfigured() ? "ok" : "off", whatsappConfigured() ? "Codes are being sent." : "Not switched on here. Sign in with email instead."],
    [
      "AI checks and letters",
      aiState,
      aiState === "off"
        ? "Not connected here. The template letter still works."
        : aiState === "down"
          ? "Most AI requests failed in the last day. Use Build from template for your letter, and try the check later."
          : aiState === "slow"
            ? "The free AI tier was busy at times today. If a check fails, wait a minute and try again."
            : `Working. ${ai.total} AI requests in the last 24 hours.`,
    ],
  ];
  const label = { ok: "Working", slow: "Busy at times", down: "Not working", off: "Off" };
  return (
    <ul className="status-list">
      {rows.map(([name, state, text]) => (
        <li key={name} className={state}>
          <b>{name}</b>
          <span className="st">{label[state]}</span>
          <p>{text}</p>
        </li>
      ))}
    </ul>
  );
}
