// n8n Code node "Build Gemini request" in the proofnest-letter workflow.
// Input: the Webhook node's item, whose body is the payload sent by /api/flats/[id]/letter.
// Output: { model, request } — the model id and the JSON body for Gemini's generateContent.

const p = $input.first().json.body || {};

// ProofNest can override these per request (AI_MODEL / AI_THINKING_LEVEL on Vercel) without editing this node.
const MODEL = p.model || "gemini-3.8-flash";
const THINKING = String(p.thinkingLevel || "low").toUpperCase();
const flat = p.flat || {};
const rupees = (v) => (v == null || v === "" ? "[not given]" : "₹" + Number(v).toLocaleString("en-IN"));
// Only languages ProofNest offers; anything else falls back to English.
const LANGUAGES = ["English", "Hindi", "Marathi", "Kannada", "Tamil", "Telugu", "Bengali", "Gujarati", "Malayalam", "Punjabi"];
const language = LANGUAGES.includes(p.language) ? p.language : "English";
const paid = [
  flat.depositPaidOn ? "on " + flat.depositPaidOn : "",
  flat.depositPaidTo ? "to " + flat.depositPaidTo : "",
  flat.depositRef ? "(reference " + flat.depositRef + ")" : "",
].filter(Boolean).join(" ");
const refunds = (p.refunds || []).map((r) =>
  (r.kind === "held" ? "Owner says they are keeping " : "Already refunded to the tenant: ") + rupees(r.amount) + (r.on ? " on " + r.on : "") + (r.note ? " (" + r.note + ")" : ""),
);

const facts = [
  "Country: India. Amounts are in Indian rupees.",
  "Flat: " + (flat.address || "[not given]"),
  "Owner or landlord: " + (flat.ownerName || "[not given]"),
  "Tenant: " + (flat.tenantName || "[not given]"),
  "Move-in date: " + (flat.moveIn || "[not given]") + "; keys handed over: " + (flat.keysHandedOver || "[not given]"),
  "Monthly rent: " + rupees(flat.monthlyRent) + "; security deposit: " + rupees(flat.deposit),
  "Deposit paid: " + (paid || "[details not given]"),
  "Deposit now held by: " + (flat.depositHolder || "the owner"),
  ...refunds,
  "Today's date: " + (p.today || "[today]"),
].join("\n");

const charges = (p.charges || []).map((c) => ({
  item: c.item,
  amount: c.amount,
  decision: c.decision,
  photos: (c.photoNs || []).map((n) => "P" + n),
  reason: c.reason || "",
}));

const cited = (p.citedPhotos || []).map((ph) => `P${ph.n} (${ph.room}, taken ${ph.takenAt || "at move-in"}): ${ph.note || "no note"}`);

const prompt = [
  "Write a letter in " + (language === "English" ? "Indian English" : language) + " from a tenant to their flat's owner asking for the refund of their security deposit and disputing some deductions. It will be sent on WhatsApp or email, so keep it polite, firm and easy to read on a phone.",
  "",
  "FACTS",
  facts,
  "",
  "CHARGES WITH THE TENANT'S DECISION (JSON)",
  JSON.stringify(charges),
  "",
  "PHOTOS CITED (move-in unless the room says move-out)",
  cited.length ? cited.join("\n") : "(none)",
  "",
  "OTHER EVIDENCE",
  String(p.evidence || "(none)").slice(0, 4000),
  "",
  "RENT AGREEMENT",
  String(p.agreement || "(not uploaded)").slice(0, 4000),
  "",
  "RULES",
  "- Format: sender details, date, 'To,' with the owner's name and the flat address, a 'Subject:' line, 'Dear <owner>,' and 'Regards,' with the tenant's name.",
  "- Dispute every charge whose decision is already_there, wear_and_tear or no_receipt, in one or two sentences each, citing the photo numbers and evidence given.",
  "- For decision check, ask the owner to explain the charge and share the bill or supporting documents.",
  "- Accept likely_valid charges together in one sentence.",
  "- Say the move-in photos with dates are attached.",
  "- Where a rent agreement clause above supports the tenant, mention it by clause number.",
  "- Ask the owner to refund the deposit minus only the accepted charges to the tenant's bank account or UPI ID within 7 days, and to share bills before deducting anything else. Write amounts as ₹ with Indian digit grouping, like ₹1,50,000.",
  "- Use [square brackets] for anything not given, like [Your UPI ID].",
  "- If the deposit payment details are given, mention when and how it was paid. If part has already been refunded, ask only for the rest. If someone other than the owner holds the deposit now, address the letter to the owner and say it should also go to them.",
  ...(language === "English"
    ? []
    : ["- Write the whole letter in " + language + ", in the script normally used for it. Keep ₹ amounts in digits, photo numbers like P3, clause numbers, dates and names exactly as given."]),
  "- Do not cite laws, acts, penalties or legal deadlines, and do not threaten a legal notice or court. Plain text only, no Markdown, under 350 words.",
].join("\n");

return [
  {
    json: {
      model: MODEL,
      request: {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 16384,
          temperature: 0.4,
          ...(THINKING === "DEFAULT" ? {} : { thinkingConfig: { thinkingLevel: THINKING } }),
        },
      },
    },
  },
];
