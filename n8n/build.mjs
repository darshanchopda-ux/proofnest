// Builds the importable n8n workflow files from the Code node sources in n8n/src.
// Run: node n8n/build.mjs   (writes n8n/workflows/*.json)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const code = (name) => readFileSync(join(here, "src", name), "utf8");

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
      name: "Build Claude request",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [240, 0],
    },
    {
      parameters: {
        method: "POST",
        url: "https://api.anthropic.com/v1/messages",
        authentication: "genericCredentialType",
        genericAuthType: "httpHeaderAuth",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "anthropic-version", value: "2023-06-01" },
            { name: "anthropic-beta", value: "server-side-fallback-2026-07-01" },
          ],
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ JSON.stringify($json.request) }}",
        options: {
          timeout: 280000,
          response: { response: { fullResponse: true, neverError: true } },
        },
      },
      name: "Call Claude API",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [480, 0],
    },
    {
      parameters: { jsCode: code(parseFile) },
      name: "Read Claude reply",
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
      ...link("ProofNest webhook", "Build Claude request"),
      ...link("Build Claude request", "Call Claude API"),
      ...link("Call Claude API", "Read Claude reply"),
      ...link("Read Claude reply", "Respond to ProofNest"),
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
