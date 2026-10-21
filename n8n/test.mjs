// Runs the n8n Code node sources the way n8n does, with sample input, and checks their output.
// Run: node n8n/test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
function runNode(file, inputJson) {
  const $input = { first: () => ({ json: inputJson }) };
  return new Function("$input", readFileSync(join(here, "src", file), "utf8"))($input);
}

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
const req = built.json.request;
assert.equal(req.model, "claude-opus-5-5");
assert.equal(req.fallbacks, "default");
assert.equal(req.output_config.format.type, "json_schema");
assert.equal(req.output_config.format.schema.additionalProperties, false);
const blocks = req.messages[0].content;
assert.deepEqual(blocks.map((b) => b.type), ["text", "image", "text"]);
assert.match(blocks.at(-1).text, /Painting - ₹18,000/);
assert.match(blocks.at(-1).text, /P1 \| room: Kitchen \| condition at move-in: damaged/);
assert.match(blocks.at(-1).text, /Security deposit: ₹1,50,000/i);
console.log("check-build ok");

// check-parse: success, refusal, API error, bad JSON
const ok = runNode("check-parse.js", {
  statusCode: 200,
  body: { model: "claude-opus-5-5", stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: "thinking", thinking: "" }, { type: "text", text: '{"charges":[{"item":"Painting","amount":18000,"verdict":"wear_and_tear","photos":[],"reason":"Normal wear.","confidence":0.8}]}' }] },
})[0].json;
assert.equal(ok.ok, true);
assert.equal(ok.charges[0].amount, 18000);
assert.equal(runNode("check-parse.js", { statusCode: 200, body: { stop_reason: "refusal", content: [] } })[0].json.code, "refused");
assert.equal(runNode("check-parse.js", { statusCode: 529, body: { error: { message: "Overloaded" } } })[0].json.code, "busy");
assert.equal(runNode("check-parse.js", { statusCode: 200, body: { stop_reason: "end_turn", content: [{ type: "text", text: "not json" }] } })[0].json.code, "invalid_json");
console.log("check-parse ok");

// letter-build and letter-parse
const [letterReq] = runNode("letter-build.js", { body: { ...payload, today: "21 Oct 2026", charges: [{ item: "Painting", amount: 18000, decision: "wear_and_tear", photoNs: [1], reason: "" }], citedPhotos: payload.photos } });
assert.equal(letterReq.json.request.model, "claude-opus-5-5");
assert.match(letterReq.json.request.messages[0].content, /"photos":\["P1"\]/);
const letter = runNode("letter-parse.js", { statusCode: 200, body: { stop_reason: "end_turn", content: [{ type: "text", text: "Dear Mr. Sharma," }] } })[0].json;
assert.equal(letter.ok, true);
assert.equal(letter.letter, "Dear Mr. Sharma,");
console.log("letter-build and letter-parse ok");
