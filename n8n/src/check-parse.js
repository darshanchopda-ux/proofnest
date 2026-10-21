// n8n Code node "Read Claude reply" in the proofnest-check workflow.
// Input: the HTTP Request node's full response ({ statusCode, body, headers }), with "Never error" on.
// Output: what the Respond to Webhook node returns to ProofNest.

const res = $input.first().json;
const body = typeof res.body === "string" ? safeJson(res.body) : res.body || {};

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function fail(error, code) {
  return [{ json: { ok: false, code, error, model: body.model || "", usage: body.usage || null } }];
}

if (res.statusCode && res.statusCode !== 200) {
  const message = (body.error && body.error.message) || "The Claude API returned status " + res.statusCode + ".";
  return fail(message, res.statusCode === 429 || res.statusCode === 529 ? "busy" : "api_error");
}
if (body.stop_reason === "refusal") return fail("Claude declined to check these deductions. Edit the list and try again.", "refused");
if (body.stop_reason === "max_tokens") return fail("The answer was cut short. Paste fewer charges at a time.", "truncated");

const text = (body.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
const parsed = safeJson(text);
if (!parsed || !Array.isArray(parsed.charges)) return fail("Claude's answer couldn't be read. Try again.", "invalid_json");

return [{ json: { ok: true, charges: parsed.charges, model: body.model || "", usage: body.usage || null } }];
