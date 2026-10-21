// n8n Code node "Build Gemini request" in the proofnest-agreement workflow.
// Input: the Webhook node's item, whose body is the payload sent by /api/flats/[id]/agreement.
// Output: { model, request } — the model id and the JSON body for Gemini's generateContent.

const p = $input.first().json.body || {};

// ProofNest can override these per request (AI_MODEL / AI_THINKING_LEVEL on Vercel) without editing this node.
const MODEL = p.model || "gemini-3.8-flash";
const THINKING = String(p.thinkingLevel || "low").toUpperCase();
const TOPICS = ["Deposit refund", "Painting", "Deductions", "Repairs and maintenance", "Lock-in", "Notice period", "Rent increase", "Other"];

const files = p.files || [];
const pasted = String(p.text || "").slice(0, 60000);

// Gemini reads PDFs (text and scanned pages) and photos natively, so each file goes in as it is.
const parts = [];
files.forEach((f, i) => {
  parts.push({ text: `Agreement file ${i + 1} of ${files.length}: ${f.name || "page"}` });
  parts.push({ inline_data: { mime_type: f.mediaType || "application/pdf", data: f.data } });
});

const instructions = [
  "You are reading a residential rent agreement (or leave and licence agreement) from India on behalf of the tenant.",
  "Extract the facts and the clauses that matter when the tenant moves out and asks for the security deposit back.",
  ...(files.length
    ? [`The ${files.length === 1 ? "file above is" : files.length + " files above are"} the agreement${files.length > 1 ? ", in order" : ""}. Scans and photos may be tilted, faint or partly in Hindi or another Indian language; read them carefully and answer in English.`]
    : []),
  ...(pasted ? ['AGREEMENT TEXT PASTED BY THE TENANT\n"""\n' + pasted + '\n"""'] : []),
  "",
  "RULES",
  "- isAgreement is false if this is not a rent or leave and licence agreement for a home. Then leave every other field null or empty.",
  "- Dates as YYYY-MM-DD. Amounts in rupees as plain numbers (1.5 lakh = 150000; 30k = 30000).",
  "- refundDays: days after the tenant vacates or hands over the keys within which the deposit must be returned. 0 if it is returned at the time of vacating or handing over. null if not stated.",
  "- maintenance, lockIn and noticePeriod are short phrases in plain English, like \"11 months\" or \"1 month's written notice\".",
  "- clauses: up to 12, those that matter for the deposit first: deposit refund, painting, deductions, repairs, lock-in, notice period. topic is one of: " + TOPICS.join(", ") + ".",
  "- quote is copied exactly from the agreement, at most 300 characters (translate to English only if the original is not in English). clause is the clause number if shown, otherwise an empty string. plain is one plain sentence for the tenant.",
  "- watchOut lists up to 5 terms that could cost the tenant money at move-out, such as a fixed painting charge, a long lock-in or a deduction for normal wear and tear. Empty if none.",
  "- pageCount is the total number of agreement pages you were given.",
  "- Use null for anything the agreement does not state. Never guess or invent.",
].join("\n");
parts.push({ text: instructions });

// Gemini's response schema uses OpenAPI-style uppercase types; nullable marks facts the agreement may not state.
const text = { type: "STRING", nullable: true };
const number = { type: "NUMBER", nullable: true };
const factKeys = ["ownerName", "tenantName", "address", "agreementDate", "startDate", "endDate", "monthlyRent", "securityDeposit", "maintenance", "lockIn", "noticePeriod", "refundDays"];
const responseSchema = {
  type: "OBJECT",
  properties: {
    isAgreement: { type: "BOOLEAN" },
    ownerName: text,
    tenantName: text,
    address: text,
    agreementDate: text,
    startDate: text,
    endDate: text,
    monthlyRent: number,
    securityDeposit: number,
    maintenance: text,
    lockIn: text,
    noticePeriod: text,
    refundDays: { type: "INTEGER", nullable: true },
    clauses: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          topic: { type: "STRING", enum: TOPICS },
          clause: { type: "STRING" },
          quote: { type: "STRING" },
          plain: { type: "STRING" },
        },
        required: ["topic", "clause", "quote", "plain"],
        propertyOrdering: ["topic", "clause", "quote", "plain"],
      },
    },
    watchOut: { type: "ARRAY", items: { type: "STRING" } },
    pageCount: { type: "INTEGER" },
  },
  required: ["isAgreement", ...factKeys, "clauses", "watchOut", "pageCount"],
  propertyOrdering: ["isAgreement", ...factKeys, "clauses", "watchOut", "pageCount"],
};

return [
  {
    json: {
      model: MODEL,
      request: {
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema,
          maxOutputTokens: 32768,
          temperature: 0.1,
          ...(THINKING === "DEFAULT" ? {} : { thinkingConfig: { thinkingLevel: THINKING } }),
        },
      },
    },
  },
];
