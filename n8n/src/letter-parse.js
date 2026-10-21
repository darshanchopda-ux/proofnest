// n8n Code node "Read Claude reply" in the proofnest-letter workflow.
// Input: the HTTP Request node's full response ({ statusCode, body, headers }), with "Never error" on.
// Output: what the Respond to Webhook node returns to ProofNest.

const res = $input.first().json;
let body = res.body || {};
if (typeof body === "string") {
  try {
    body = JSON.parse(body);
  } catch {
    body = {};
  }
}

function fail(error, code) {
  return [{ json: { ok: false, code, error, model: body.model || "", usage: body.usage || null } }];
}

if (res.statusCode && res.statusCode !== 200) {
  const message = (body.error && body.error.message) || "The Claude API returned status " + res.statusCode + ".";
  return fail(message, res.statusCode === 429 || res.statusCode === 529 ? "busy" : "api_error");
}
if (body.stop_reason === "refusal") return fail("Claude declined to write this letter. Use Build from template instead.", "refused");

const letter = (body.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
if (!letter) return fail("No letter came back. Try again.", "empty");

return [{ json: { ok: true, letter, truncated: body.stop_reason === "max_tokens", model: body.model || "", usage: body.usage || null } }];
