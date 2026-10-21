# ProofNest n8n workflows

Three workflows do ProofNest's AI work. ProofNest's server calls them; they call Google's Gemini API (`gemini-3.8-flash`, free tier) and send the result back.

| Workflow file | Webhook path | Called by | Does |
|---|---|---|---|
| `workflows/proofnest-check.json` | `proofnest-check` | `POST /api/flats/[id]/check` | Labels every charge in the owner's deductions using the move-in photos, notes and agreement |
| `workflows/proofnest-letter.json` | `proofnest-letter` | `POST /api/flats/[id]/letter` | Writes the refund letter from the tenant's decisions |
| `workflows/proofnest-agreement.json` | `proofnest-agreement` | `POST /api/flats/[id]/agreement` | Reads the rent agreement (PDF, page photos or pasted text) and returns its key facts, clauses and terms to watch |

Each workflow: **ProofNest webhook** (checks a shared secret) → **Build Gemini request** → **Call Gemini API** → **Read Gemini reply** → **Respond to ProofNest**.

## Set up in n8n (about 10 minutes)

1. **Create two credentials** (Overview → Credentials → Create credential → *Header Auth*):
   - **ProofNest shared secret**: Name `x-proofnest-secret`, Value = the `N8N_WEBHOOK_SECRET` from ProofNest's `.env.local`.
   - **Gemini API key**: Name `x-goog-api-key`, Value = a free key from aistudio.google.com → *Get API key*. Under *Allowed HTTP Request Domains*, choose *Specific domains* and enter `generativelanguage.googleapis.com`.
2. **Import the workflows**: Workflows → Create → ⋯ menu → *Import from file* → pick `workflows/proofnest-check.json`. Repeat for `proofnest-letter.json` and `proofnest-agreement.json`.
3. In each workflow, open **ProofNest webhook** and choose the *ProofNest shared secret* credential. Open **Call Gemini API** and choose the *Gemini API key* credential. Save.
4. **Publish** each workflow (button at the top right). Only published workflows answer on the production URL.
5. Copy the webhook's **Production URL** base, everything before `/proofnest-check`, for example `https://pgp27-n8n.mesaschool.co.in/webhook`. Send it to whoever runs ProofNest's Vercel settings, or set it yourself:

   ```bash
   vercel env add N8N_WEBHOOK_BASE production --value "https://yourname.app.n8n.cloud/webhook" --yes
   vercel env add N8N_WEBHOOK_BASE preview --value "https://yourname.app.n8n.cloud/webhook" --yes
   ```

   For local development, put the same line in `.env.local`. Then redeploy.

## Test it

In n8n, open a workflow, click **Execute workflow**, and send a test request from ProofNest (open the example flat, step 2, *Check with AI*). The execution shows each node's input and output, including Gemini's raw reply and token usage.

## Edit the prompts

The Code node sources live in `src/`. After editing them:

```bash
node n8n/test.mjs    # runs the Code nodes with sample input
node n8n/build.mjs   # regenerates workflows/*.json
```

Then re-import the changed workflow in n8n, or paste the new code into its Code node.

## Request details

- `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent`, key in the `x-goog-api-key` header.
- The check asks for JSON (`generationConfig.responseMimeType` `application/json` with a `responseSchema`) so the reply parses; the reader also strips a code fence if one appears.
- Thinking is set to `LOW` (`generationConfig.thinkingConfig.thinkingLevel`). Gemini's own default took 142 seconds and about 16,000 output tokens for a three-charge check; thinking tokens count toward `maxOutputTokens` (32,768 for the check, 16,384 for the letter).
- Free tier: Google applies per-minute and per-day limits (see your limits in AI Studio). A quota or overload error comes back to ProofNest as `{ ok: false, code: "busy" }`. ProofNest retries once after 5 seconds if at least 90 seconds of its time budget are left, and otherwise shows a "try again" message.
- To change the model or thinking level without editing n8n, set `AI_MODEL` (for example `gemini-3.5-flash-lite` if the daily limit is too low) or `AI_THINKING_LEVEL` (`minimal`, `low`, `medium`, `high`, or `default` for Gemini's own) in ProofNest's Vercel settings and redeploy. ProofNest sends them with each request.
- Privacy: on the free tier, Google may use what you send, including photos, to improve its products. The paid tier doesn't. ProofNest says this next to the AI buttons.
- HTTP timeout 280 seconds. ProofNest's routes allow 300.
- ProofNest sends at most 8 photos per check, each resized to 1568px, plus an optional screenshot of the owner's message.
- Agreement reads send PDFs as they are (Gemini reads text and scanned pages) and page photos resized to 2000px, at most 15 files and about 12 MB of base64 per read, under n8n's default 16 MB request limit. ProofNest checks every field Gemini returns before saving it.
