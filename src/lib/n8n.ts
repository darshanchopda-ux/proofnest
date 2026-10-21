import "server-only";

export type WorkflowUsage = { input_tokens?: number; output_tokens?: number } | null;
export type WorkflowFailure = { ok: false; code: string; error: string; model?: string; usage?: WorkflowUsage };

export function n8nConfigured(): boolean {
  return Boolean(process.env.N8N_WEBHOOK_BASE && process.env.N8N_WEBHOOK_SECRET);
}

/**
 * Calls one of ProofNest's n8n workflows (see n8n/README.md) and returns its JSON reply.
 * Network failures and non-JSON replies come back as { ok: false } rather than throwing.
 */
export async function callWorkflow<T extends { ok: true }>(path: "proofnest-check" | "proofnest-letter", payload: unknown): Promise<T | WorkflowFailure> {
  if (!n8nConfigured()) return { ok: false, code: "not_configured", error: "AI checking isn't connected yet." };
  const base = process.env.N8N_WEBHOOK_BASE!.replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-proofnest-secret": process.env.N8N_WEBHOOK_SECRET! },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(285_000),
      cache: "no-store",
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, code: "bad_reply", error: res.ok ? "The AI workflow sent back something unexpected." : `The AI workflow returned status ${res.status}.` };
    }
    if (!res.ok && !(json && typeof json === "object" && "ok" in json)) {
      return { ok: false, code: "workflow_error", error: `The AI workflow returned status ${res.status}.` };
    }
    return json as T | WorkflowFailure;
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    return { ok: false, code: timedOut ? "timeout" : "unreachable", error: timedOut ? "Claude took too long. Try again." : "Couldn't reach the AI workflow." };
  }
}
