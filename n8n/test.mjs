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
assert.deepEqual(req.generationConfig.thinkingConfig, { thinkingLevel: "LOW" });
const [overridden] = runNode("check-build.js", { body: { ...payload, model: "gemini-3.5-flash-lite", thinkingLevel: "default" } });
assert.equal(overridden.json.model, "gemini-3.5-flash-lite");
assert.equal(overridden.json.request.generationConfig.thinkingConfig, undefined);
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
assert.deepEqual(letterReq.json.request.generationConfig.thinkingConfig, { thinkingLevel: "LOW" });
assert.match(letterReq.json.request.contents[0].parts[0].text, /"photos":\["P1"\]/);
const letter = runNode("letter-parse.js", gemini("Dear Mr. Sharma,"))[0].json;
assert.equal(letter.ok, true);
assert.equal(letter.letter, "Dear Mr. Sharma,");
assert.equal(runNode("letter-parse.js", gemini("Dear", { candidates: [{ content: { parts: [{ text: "Dear" }] }, finishReason: "MAX_TOKENS" }] }))[0].json.truncated, true);
const [hindiReq] = runNode("letter-build.js", { body: { ...payload, language: "Hindi", refunds: [{ kind: "received", amount: 50000, on: "1 Oct 2026" }], charges: [] } });
assert.match(hindiReq.json.request.contents[0].parts[0].text, /Write a letter in Hindi/);
assert.match(hindiReq.json.request.contents[0].parts[0].text, /Already refunded to the tenant: ₹50,000 on 1 Oct 2026/);
const [oddReq] = runNode("letter-build.js", { body: { ...payload, language: "Klingon", charges: [] } });
assert.match(oddReq.json.request.contents[0].parts[0].text, /Write a letter in Indian English/);
console.log("letter-build and letter-parse ok");

// agreement-build and agreement-parse
const [agReq] = runNode("agreement-build.js", { body: { files: [{ name: "agreement.pdf", mediaType: "application/pdf", data: "JVBERi0=" }, { name: "page-2.jpg", mediaType: "image/jpeg", data: "AAAA" }], text: "" } });
const agParts = agReq.json.request.contents[0].parts;
assert.deepEqual(agParts.map((p) => Object.keys(p)[0]), ["text", "inline_data", "text", "inline_data", "text"]);
assert.equal(agParts[1].inline_data.mime_type, "application/pdf");
assert.match(agParts.at(-1).text, /The 2 files above are the agreement, in order/);
assert.doesNotMatch(agParts.at(-1).text, /PASTED/);
const agSchema = agReq.json.request.generationConfig.responseSchema;
assert.equal(agSchema.properties.refundDays.nullable, true);
assert.deepEqual(agSchema.required, agSchema.propertyOrdering);
assert.deepEqual(agReq.json.request.generationConfig.thinkingConfig, { thinkingLevel: "LOW" });
const [pastedReq] = runNode("agreement-build.js", { body: { files: [], text: "Clause 4: deposit refunded at handover." } });
assert.deepEqual(pastedReq.json.request.contents[0].parts.map((p) => Object.keys(p)[0]), ["text"]);
assert.match(pastedReq.json.request.contents[0].parts[0].text, /Clause 4: deposit refunded at handover/);
const agOk = runNode("agreement-parse.js", gemini('{"isAgreement":true,"ownerName":"R. Sharma","refundDays":0,"clauses":[],"watchOut":[],"pageCount":3}'))[0].json;
assert.equal(agOk.ok, true);
assert.equal(agOk.agreement.ownerName, "R. Sharma");
assert.equal(runNode("agreement-parse.js", gemini("[1,2]"))[0].json.code, "invalid_json");
assert.equal(runNode("agreement-parse.js", { statusCode: 503, body: { error: { message: "overloaded" } } })[0].json.code, "busy");
console.log("agreement-build and agreement-parse ok");
