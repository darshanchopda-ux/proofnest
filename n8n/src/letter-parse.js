// n8n Code node "Read Gemini reply" in the proofnest-letter workflow (readGemini is prepended from gemini-reply.js).
// Input: the HTTP Request node's full response ({ statusCode, body, headers }), with "Never error" on.
// Output: what the Respond to Webhook node returns to ProofNest.

const reply = readGemini($input.first().json);
if (reply.failure) return [{ json: reply.failure }];
return [{ json: { ok: true, letter: reply.text, truncated: reply.truncated, model: reply.model, usage: reply.usage } }];
