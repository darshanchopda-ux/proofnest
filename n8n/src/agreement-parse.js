// n8n Code node "Read Gemini reply" in the proofnest-agreement workflow (readGemini is prepended from gemini-reply.js).
// Input: the HTTP Request node's full response ({ statusCode, body, headers }), with "Never error" on.
// Output: what the Respond to Webhook node returns to ProofNest, which checks and cleans every field itself.

const reply = readGemini($input.first().json);
if (reply.failure) return [{ json: reply.failure }];
if (reply.truncated) return [{ json: { ok: false, code: "truncated", error: "The answer was cut short. Try fewer pages at a time.", model: reply.model, usage: reply.usage } }];

let parsed = null;
try {
  // Strip a Markdown code fence in case the model wraps its JSON in one.
  parsed = JSON.parse(reply.text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
} catch {
  parsed = null;
}
if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
  return [{ json: { ok: false, code: "invalid_json", error: "The AI's answer couldn't be read. Try again.", model: reply.model, usage: reply.usage } }];
}
return [{ json: { ok: true, agreement: parsed, model: reply.model, usage: reply.usage } }];
