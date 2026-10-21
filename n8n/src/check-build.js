// n8n Code node "Build Claude request" in the proofnest-check workflow.
// Input: the Webhook node's item, whose body is the payload sent by /api/flats/[id]/check.
// Output: { request } — the JSON body for POST https://api.anthropic.com/v1/messages.

const p = $input.first().json.body || {};
const flat = p.flat || {};
const rupees = (v) => (v == null || v === "" ? "[not given]" : "₹" + Number(v).toLocaleString("en-IN"));

const facts = [
  "Country: India. Amounts are in Indian rupees.",
  "Flat: " + (flat.address || "[not given]"),
  "Owner or landlord: " + (flat.ownerName || "[not given]"),
  "Move-in date: " + (flat.moveIn || "[not given]") + "; keys handed over: " + (flat.keysHandedOver || "[not given]"),
  "Monthly rent: " + rupees(flat.monthlyRent) + "; security deposit: " + rupees(flat.deposit),
].join("\n");

const photoLines = (p.photos || []).length
  ? p.photos
      .map((ph) => `P${ph.n} | room: ${ph.room} | condition at move-in: ${ph.condition} | note: ${ph.note || "(none)"}${ph.takenAt ? " | taken " + ph.takenAt : ""}`)
      .join("\n")
  : "(no move-in photos recorded)";

const images = p.images || [];
const content = [];
if (p.screenshot && p.screenshot.data) {
  content.push({ type: "text", text: "Screenshot or photo of the owner's deductions (often a WhatsApp message or a handwritten bill). Read every charge from it:" });
  content.push({ type: "image", source: { type: "base64", media_type: p.screenshot.mediaType || "image/jpeg", data: p.screenshot.data } });
}
for (const img of images) {
  content.push({ type: "text", text: `Move-in photo ${img.label}:` });
  content.push({ type: "image", source: { type: "base64", media_type: img.mediaType || "image/jpeg", data: img.data } });
}

const instructions = [
  "You are helping a tenant in India check the deductions their owner (landlord) wants to make from their security deposit after they vacated a rented flat, against the tenant's own move-in record.",
  "Common deductions in India include painting charges, deep cleaning, repairs to fittings, tiles or furniture, unpaid electricity, water or maintenance bills, and lock-in or notice period charges.",
  "",
  "CASE",
  facts,
  "",
  "OWNER'S DEDUCTIONS",
  '"""',
  String(p.deductions || "(see the screenshot)").slice(0, 8000),
  '"""',
  "",
  "TENANT'S MOVE-IN PHOTOS",
  photoLines,
  images.length ? `The ${images.length} photo${images.length === 1 ? " shown above is" : "s shown above are"} labelled with their P-number. Photos not shown are known only from their notes.` : "No photos are attached. Rely on the photo notes above.",
  "",
  "OTHER EVIDENCE FROM THE TENANT (WhatsApp messages, emails, rent agreement clauses)",
  '"""',
  String(p.evidence || "(none)").slice(0, 6000),
  '"""',
  "",
  "RENT AGREEMENT (key terms read from the tenant's agreement)",
  String(p.agreement || "(not uploaded)").slice(0, 6000),
  "",
  "For each charge, choose exactly one verdict:",
  '- "already_there": the move-in photos or notes show this damage or condition existed before the tenancy.',
  '- "wear_and_tear": normal deterioration from regular use during the stay (faded or patchy paint, small marks, worn fittings), unless a rent agreement clause above makes the tenant pay for it.',
  '- "no_receipt": no bill, receipt or quotation has been shared, or the amount is a round guess or too vague to check.',
  '- "likely_valid": the tenant\'s evidence does not support disputing it, for example genuine unpaid bills, or a charge the rent agreement clearly allows.',
  '- "check": unclear, not a damage charge (rent, lock-in or notice period charges), a charge the rent agreement may allow, or the tenant has to decide.',
  "Cite only photos by their P-number exactly as listed (for example \"P4\"), and only evidence written above. Never invent photos, facts, laws, acts or deadlines. Ignore lines that are not charges, such as totals or the deposit amount.",
  "amount is the charge in rupees as a plain number (1.5 lakh = 150000; 18k = 18000; 0 if none). photos lists the P-numbers that support the verdict. reason is one plain sentence addressed to the tenant. confidence is between 0 and 1.",
].join("\n");
content.push({ type: "text", text: instructions });

const schema = {
  type: "object",
  properties: {
    charges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: { type: "string" },
          amount: { type: "number" },
          verdict: { type: "string", enum: ["already_there", "wear_and_tear", "no_receipt", "likely_valid", "check"] },
          photos: { type: "array", items: { type: "string" } },
          reason: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["item", "amount", "verdict", "photos", "reason", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["charges"],
  additionalProperties: false,
};

return [
  {
    json: {
      request: {
        model: "claude-opus-5-5",
        max_tokens: 16000,
        // If a safety classifier declines, the API re-runs the request on Anthropic's recommended fallback model.
        fallbacks: "default",
        output_config: { effort: "medium", format: { type: "json_schema", schema } },
        messages: [{ role: "user", content }],
      },
    },
  },
];
