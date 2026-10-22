# ProofNest

Helps tenants in India get their security deposit back: record the flat's condition at move-in, check the owner's deductions against those photos, and send a refund letter.

Live: https://proofnest-three.vercel.app (Vercel project `proofnest` in the VBC125 team; functions and Blob store in Singapore, `sin1`).

## Stack

| Layer | What |
|---|---|
| Frontend and server | Next.js 16 (App Router, Cache Components), deployed on Vercel |
| Database | Neon Postgres (project `proofnest`, Singapore) via Drizzle ORM |
| Sign-in | Neon Auth (Managed Better Auth), email and password |
| Files | Vercel Blob, **private** store. Photos are only served through `/api/photos/[id]` after an ownership check |
| AI | n8n workflows calling Google's Gemini API (`gemini-3.8-flash`, free tier). Setup: [n8n/README.md](n8n/README.md) |

## Run it locally

```bash
cp .env.example .env.local   # then fill in the values
npm install
npm run db:migrate           # applies drizzle/*.sql to Neon
npm run dev
```

| Variable | Where it comes from |
|---|---|
| `DATABASE_URL` | Neon console, pooled connection string |
| `NEON_AUTH_BASE_URL` | Neon console, Auth settings |
| `NEON_AUTH_COOKIE_SECRET` | `openssl rand -base64 32` |
| `BLOB_READ_WRITE_TOKEN` | Vercel project, Storage, the private Blob store |
| `N8N_WEBHOOK_BASE` | n8n webhook Production URL base, e.g. `https://yourname.app.n8n.cloud/webhook` |
| `N8N_WEBHOOK_SECRET` | `openssl rand -hex 24`; the same value goes in n8n's *ProofNest shared secret* credential |

## Database

Schema lives in `src/db/schema.ts`. After changing it:

```bash
npm run db:generate -- --name describe_the_change
npm run db:migrate
```

`flats.user_id` references `neon_auth."user"`. Neon Auth owns that table, so the foreign key is a hand-written migration (`drizzle/0001_auth_fk.sql`).

## Where things are

- `src/app/page.tsx`: welcome screen and the signed-in user's flats
- `src/app/flats/new`: two-step setup
- `src/app/flats/[id]`: the flat workspace (header, steps, "What to do next", move-in record)
- `src/app/flats/actions.ts`: server actions; every one re-checks the session and flat ownership
- `src/app/api/upload`: issues Blob upload tokens limited to the flat's own folder
- `src/app/api/photos/[id]`: streams a private photo to its owner
- `src/lib/photo-client.ts`: EXIF capture time and SHA-256 fingerprint, computed in the browser
- `src/app/api/flats/[id]/check` and `/letter`: call the n8n workflows; photos are resized to 1568px with sharp first
- `src/app/api/flats/[id]/agreement`: reads an uploaded rent agreement (PDF or page photos, or pasted text) through n8n and saves its key terms; `/agreement/files/[n]` serves its files privately
- `n8n/`: the three workflows, their Code node sources and tests

## Sign in with WhatsApp

People sign in with their mobile number: ProofNest sends a 6-digit code through Meta's WhatsApp Cloud API (an approved *Authentication* template with a copy-code button), stores only a keyed hash of it (5 minutes, 5 tries, rate-limited per number and per connection), and on a match signs them in to the account for that number, creating it on first use. Email and password stay available. Set `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` (see `.env.example`); without them the live site shows email sign-in only.

## Status

Phase 1 to 3 are in: sign-in, flats, rooms, photo upload with capture time and fingerprint, details, WhatsApp summary, the AI deduction check with per-charge decisions, the refund letter (AI or template), and rent agreement reading (key facts, clauses, terms to watch, and suggested flat details), whose clauses feed the check and the letter.
