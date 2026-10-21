// Shared by every "Read Gemini reply" Code node (build.mjs prepends it).
// Turns Gemini's generateContent response into { text } or a ProofNest failure.

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- called by the parse code that follows it
function readGemini(res) {
  let body = res.body || {};
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const usage = body.usageMetadata
    ? { input_tokens: body.usageMetadata.promptTokenCount || 0, output_tokens: (body.usageMetadata.candidatesTokenCount || 0) + (body.usageMetadata.thoughtsTokenCount || 0) }
    : null;
  const model = body.modelVersion || "";
  const fail = (error, code) => ({ failure: { ok: false, code, error, model, usage } });

  if (res.statusCode && res.statusCode !== 200) {
    if (res.statusCode === 429) return fail("The free AI quota is used up for now. Wait a minute and try again, or try again tomorrow.", "busy");
    if (res.statusCode === 503) return fail("The AI service is busy. Try again in a minute.", "busy");
    const message = (body.error && body.error.message) || "The Gemini API returned status " + res.statusCode + ".";
    return fail(message, "api_error");
  }
  if (body.promptFeedback && body.promptFeedback.blockReason) return fail("The AI declined this request. Edit the text and try again.", "refused");

  const candidate = (body.candidates || [])[0];
  if (!candidate) return fail("No answer came back. Try again.", "empty");
  const reason = candidate.finishReason || "STOP";
  if (["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_SAFETY"].includes(reason)) {
    return fail("The AI declined this request. Edit the text and try again.", "refused");
  }
  const text = ((candidate.content && candidate.content.parts) || [])
    .filter((part) => typeof part.text === "string" && !part.thought)
    .map((part) => part.text)
    .join("")
    .trim();
  if (!text) return fail(reason === "MAX_TOKENS" ? "The answer was cut short. Paste fewer charges at a time." : "No answer came back. Try again.", reason === "MAX_TOKENS" ? "truncated" : "empty");
  return { text, truncated: reason === "MAX_TOKENS", model, usage };
}
