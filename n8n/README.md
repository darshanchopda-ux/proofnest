# ProofNest n8n workflows

Two workflows do ProofNest's AI work. ProofNest's server calls them; they call the Claude API (`claude-opus-5-5`) and send the result back.

| Workflow file | Webhook path | Called by | Does |
|---|---|---|---|
| `workflows/proofnest-check.json` | `proofnest-check` | `POST /api/flats/[id]/check` | Labels every charge in the owner's deductions using the move-in photos, notes and agreement |
| `workflows/proofnest-letter.json` | `proofnest-letter` | `POST /api/flats/[id]/letter` | Writes the refund letter from the tenant's decisions |

Each workflow: **ProofNest webhook** (checks a shared secret) → **Build Claude request** → **Call Claude API** → **Read Claude reply** → **Respond to ProofNest**.

## Set up in n8n Cloud (about 10 minutes)

1. **Create two credentials** (Overview → Credentials → Create credential → *Header Auth*):
   - **ProofNest shared secret**: Name `x-proofnest-secret`, Value = the `N8N_WEBHOOK_SECRET` from ProofNest's `.env.local`.
   - **Anthropic API key**: Name `x-api-key`, Value = your Anthropic API key from console.anthropic.com.
2. **Import both workflows**: Workflows → Create → ⋯ menu → *Import from file* → pick `workflows/proofnest-check.json`. Repeat for `proofnest-letter.json`.
3. In each workflow, open **ProofNest webhook** and choose the *ProofNest shared secret* credential. Open **Call Claude API** and choose the *Anthropic API key* credential. Save.
4. **Activate** both workflows (toggle at the top right). Only active workflows answer on the production URL.
5. Copy the webhook's **Production URL** base, everything before `/proofnest-check`, for example `https://yourname.app.n8n.cloud/webhook`. Send it to whoever runs ProofNest's Vercel settings, or set it yourself:

   ```bash
   vercel env add N8N_WEBHOOK_BASE production --value "https://yourname.app.n8n.cloud/webhook" --yes
   vercel env add N8N_WEBHOOK_BASE preview --value "https://yourname.app.n8n.cloud/webhook" --yes
   ```

   For local development, put the same line in `.env.local`. Then redeploy.

## Test it

In n8n, open a workflow, click **Execute workflow**, and send a test request from ProofNest (open the example flat, step 2, *Check with Claude*). The execution shows each node's input and output, including Claude's raw reply and token usage.

## Edit the prompts

The Code node sources live in `src/`. After editing them:

```bash
node n8n/test.mjs    # runs the Code nodes with sample input
node n8n/build.mjs   # regenerates workflows/*.json
```

Then re-import the changed workflow in n8n, or paste the new code into its Code node.

## Request details

- Model `claude-opus-5-5`, `max_tokens` 16000, `output_config.effort` `medium`.
- The check uses structured outputs (`output_config.format`, JSON schema) so the reply always parses.
- `fallbacks: "default"` with the `anthropic-beta: server-side-fallback-2026-07-01` header: if a safety classifier declines, the API re-runs the request on Anthropic's recommended fallback model. A refusal that still happens comes back to ProofNest as `{ ok: false, code: "refused" }`.
- HTTP timeout 280 seconds. ProofNest's routes allow 300.
- ProofNest sends at most 8 photos per check, each resized to 1568px, plus an optional screenshot of the owner's message.
