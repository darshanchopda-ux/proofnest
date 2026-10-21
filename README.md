# ProofNest

Helps tenants in India get their security deposit back: record the flat's condition at move-in, check the owner's deductions against those photos, and send a refund letter.

## Stack

| Layer | What |
|---|---|
| Frontend and server | Next.js 16 (App Router, Cache Components), deployed on Vercel |
| Database | Neon Postgres (project `proofnest`, Singapore) via Drizzle ORM |
| Sign-in | Neon Auth (Managed Better Auth), email and password |
| Files | Vercel Blob, **private** store. Photos are only served through `/api/photos/[id]` after an ownership check |
| AI (Phase 2) | n8n workflows calling the Claude API |

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

## Status

Phase 1 (foundation) is in: sign-in, flats, rooms, photo upload with capture time and fingerprint, details, WhatsApp summary. The deduction check, refund letter and rent agreement reading come next.
