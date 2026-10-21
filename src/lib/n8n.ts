import "server-only";

export type WorkflowUsage = { input_tokens?: number; output_tokens?: number } | null;
export type WorkflowFailure = { ok: false; code: string; error: string; model?: string; usage?: WorkflowUsage };

export function n8nConfigured(): boolean {
  return Boolean(process.env.N8N_WEBHOOK_BASE && process.env.N8N_WEBHOOK_SECRET);
}

// The routes allow 300 s; leave room for the work before and after the call.
const BUDGET_MS = 285_000;
// Gemini's free tier often says "busy" for a moment; one retry a few seconds later usually gets through.
const RETRY_DELAY_MS = 5_000;
// Only retry when a whole check (about a minute with low thinking) still fits in the budget.
const MIN_RETRY_MS = 90_000;

/**
 * Calls one of ProofNest's n8n workflows (see n8n/README.md) and returns its JSON reply.
 * Network failures and non-JSON replies come back as { ok: false } rather than throwing.
 * A "busy" reply is retried once if there's time.
 */
export async function callWorkflow<T extends { ok: true }>(path: "proofnest-check" | "proofnest-letter" | "proofnest-agreement", payload: unknown): Promise<T | WorkflowFailure> {
  if (!n8nConfigured()) return { ok: false, code: "not_configured", error: "AI checking isn't connected yet." };
  const url = `${process.env.N8N_WEBHOOK_BASE!.replace(/\/+$/, "")}/${path}`;
  const body = JSON.stringify(payload);
  const deadline = Date.now() + BUDGET_MS;

  const reply = await postOnce<T>(url, body, BUDGET_MS);
  if (reply.ok || reply.code !== "busy") return reply;
  const left = deadline - Date.now() - RETRY_DELAY_MS;
  if (left < MIN_RETRY_MS) return reply;
  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  return postOnce<T>(url, body, left);
}

async function postOnce<T extends { ok: true }>(url: string, body: string, timeoutMs: number): Promise<T | WorkflowFailure> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-proofnest-secret": process.env.N8N_WEBHOOK_SECRET! },
      body,
      signal: AbortSignal.timeout(timeoutMs),
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
    return { ok: false, code: timedOut ? "timeout" : "unreachable", error: timedOut ? "The AI took too long. Try again." : "Couldn't reach the AI workflow." };
  }
}
