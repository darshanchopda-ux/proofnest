// Builds the importable n8n workflow files from the Code node sources in n8n/src.
// Run: node n8n/build.mjs   (writes n8n/workflows/*.json)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const code = (name) => readFileSync(join(here, "src", name), "utf8");
// The two "Read Gemini reply" nodes share readGemini(); n8n Code nodes can't import, so it is inlined.
const parseCode = (name) => code("gemini-reply.js") + "\n" + code(name);

function workflow({ name, path, buildFile, parseFile }) {
  const nodes = [
    {
      parameters: { httpMethod: "POST", path, authentication: "headerAuth", responseMode: "responseNode", options: {} },
      name: "ProofNest webhook",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [0, 0],
      webhookId: path,
    },
    {
      parameters: { jsCode: code(buildFile) },
      name: "Build Gemini request",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [240, 0],
    },
    {
      parameters: {
        method: "POST",
        url: "={{ 'https://generativelanguage.googleapis.com/v1beta/models/' + $json.model + ':generateContent' }}",
        authentication: "genericCredentialType",
        genericAuthType: "httpHeaderAuth",
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ JSON.stringify($json.request) }}",
        options: {
          timeout: 280000,
          response: { response: { fullResponse: true, neverError: true } },
        },
      },
      name: "Call Gemini API",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [480, 0],
    },
    {
      parameters: { jsCode: parseCode(parseFile) },
      name: "Read Gemini reply",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [720, 0],
    },
    {
      parameters: { respondWith: "json", responseBody: "={{ JSON.stringify($json) }}", options: {} },
      name: "Respond to ProofNest",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1,
      position: [960, 0],
    },
  ];
  const link = (from, to) => ({ [from]: { main: [[{ node: to, type: "main", index: 0 }]] } });
  return {
    name,
    nodes,
    connections: {
      ...link("ProofNest webhook", "Build Gemini request"),
      ...link("Build Gemini request", "Call Gemini API"),
      ...link("Call Gemini API", "Read Gemini reply"),
      ...link("Read Gemini reply", "Respond to ProofNest"),
    },
    settings: { executionOrder: "v1" },
    pinData: {},
  };
}

const out = join(here, "workflows");
mkdirSync(out, { recursive: true });
const flows = [
  { file: "proofnest-check.json", name: "ProofNest · check deductions", path: "proofnest-check", buildFile: "check-build.js", parseFile: "check-parse.js" },
  { file: "proofnest-letter.json", name: "ProofNest · refund letter", path: "proofnest-letter", buildFile: "letter-build.js", parseFile: "letter-parse.js" },
];
for (const f of flows) {
  writeFileSync(join(out, f.file), JSON.stringify(workflow(f), null, 2) + "\n");
  console.log("wrote", join("n8n/workflows", f.file));
}
