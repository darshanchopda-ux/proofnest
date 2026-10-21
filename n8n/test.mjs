// Runs the n8n Code node sources the way n8n does, with sample input, and checks their output.
// Run: node n8n/test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = (name) => readFileSync(join(here, "src", name), "utf8");
function runNode(file, inputJson) {
  const $input = { first: () => ({ json: inputJson }) };
  // The "Read Gemini reply" nodes get gemini-reply.js prepended by build.mjs.
  const code = file.endsWith("-parse.js") ? src("gemini-reply.js") + "\n" + src(file) : src(file);
  return new Function("$input", code)($input);
}
const gemini = (text, extra = {}) => ({
  statusCode: 200,
  body: {
    candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 300, thoughtsTokenCount: 50 },
    modelVersion: "gemini-3.8-flash",
    ...extra,
  },
});

const payload = {
  flat: { address: "Flat 302, Sunrise Apartments", ownerName: "Mr. R. Sharma", tenantName: "Asha", moveIn: "2024-03-01", keysHandedOver: "2026-09-30", monthlyRent: 30000, deposit: 150000 },
  deductions: "Painting - ₹18,000\nKitchen tile repair - ₹6,000",
  evidence: "Owner on WhatsApp: tile crack is old.",
  photos: [{ n: 1, room: "Kitchen", condition: "damaged", note: "Cracked tiles", takenAt: "1 Mar 2024" }],
  images: [{ label: "P1 (Kitchen)", mediaType: "image/jpeg", data: "AAAA" }],
  screenshot: null,
  agreement: "- Painting: no fixed charge",
};

// check-build
const [built] = runNode("check-build.js", { body: payload });
assert.equal(built.json.model, "gemini-3.8-flash");
const req = built.json.request;
assert.equal(req.generationConfig.responseMimeType, "application/json");
assert.equal(req.generationConfig.responseSchema.properties.charges.items.properties.verdict.enum.length, 5);
const parts = req.contents[0].parts;
assert.deepEqual(parts.map((p) => Object.keys(p)[0]), ["text", "inline_data", "text"]);
assert.equal(parts[1].inline_data.mime_type, "image/jpeg");
assert.match(parts.at(-1).text, /Painting - ₹18,000/);
assert.match(parts.at(-1).text, /P1 \| room: Kitchen \| condition at move-in: damaged/);
assert.match(parts.at(-1).text, /security deposit: ₹1,50,000/);
console.log("check-build ok");

// check-parse: success (plain and fenced), quota, blocked, safety stop, bad JSON
const charges = '{"charges":[{"item":"Painting","amount":18000,"verdict":"wear_and_tear","photos":[],"reason":"Normal wear.","confidence":0.8}]}';
const ok = runNode("check-parse.js", gemini(charges))[0].json;
assert.equal(ok.ok, true);
assert.equal(ok.charges[0].amount, 18000);
assert.deepEqual(ok.usage, { input_tokens: 1200, output_tokens: 350 });
assert.equal(runNode("check-parse.js", gemini("```json\n" + charges + "\n```"))[0].json.ok, true);
assert.equal(runNode("check-parse.js", { statusCode: 429, body: { error: { message: "Resource exhausted" } } })[0].json.code, "busy");
assert.equal(runNode("check-parse.js", { statusCode: 200, body: { promptFeedback: { blockReason: "SAFETY" } } })[0].json.code, "refused");
assert.equal(runNode("check-parse.js", { statusCode: 200, body: { candidates: [{ content: { parts: [] }, finishReason: "SAFETY" }] } })[0].json.code, "refused");
assert.equal(runNode("check-parse.js", gemini("not json"))[0].json.code, "invalid_json");
console.log("check-parse ok");

// letter-build and letter-parse
const [letterReq] = runNode("letter-build.js", { body: { ...payload, today: "21 Oct 2026", charges: [{ item: "Painting", amount: 18000, decision: "wear_and_tear", photoNs: [1], reason: "" }], citedPhotos: payload.photos } });
assert.equal(letterReq.json.model, "gemini-3.8-flash");
assert.match(letterReq.json.request.contents[0].parts[0].text, /"photos":\["P1"\]/);
const letter = runNode("letter-parse.js", gemini("Dear Mr. Sharma,"))[0].json;
assert.equal(letter.ok, true);
assert.equal(letter.letter, "Dear Mr. Sharma,");
assert.equal(runNode("letter-parse.js", gemini("Dear", { candidates: [{ content: { parts: [{ text: "Dear" }] }, finishReason: "MAX_TOKENS" }] }))[0].json.truncated, true);
console.log("letter-build and letter-parse ok");
