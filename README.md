# PriceTrack — grocery price comparison from receipts

Upload a supermarket receipt photo, let AI extract the purchased products, and compare
prices for the same product across stores. Built for Finnish + international grocery
stores (receipt lines may be Finnish or store abbreviations; everything is normalized
to English).

**This is not a receipt archive.** The receipt image is a temporary ingestion source:

| Stored | Never stored |
|---|---|
| Stores (name, city) | Receipt images (see queue note below) |
| Canonical English products + sizes | Full OCR text |
| Raw receipt names as product aliases | Card / payment / terminal data |
| Price observations (price, weight, €/kg, date) | VAT & footer lines |

**Public submission queue:** visitors can submit receipt photos at `/submit` without an
account. No AI runs at submission. Each image is hard-validated (magic-byte sniffing —
only real JPG/PNG/WEBP, so PDFs/malware are rejected) and **fully re-encoded to a plain
JPEG with sharp** (destroys any embedded payload), rate-limited to 10/hour per IP with a
30-item queue cap, and held in Postgres only until the admin processes (AI extract →
review/edit → save) or rejects it — either action deletes the image. Untouched
submissions auto-purge after 14 days.

Only the admin can upload receipts (password login). Browsing and price comparison
are public.

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · Neon Postgres · Drizzle ORM ·
Zod · Azure OpenAI (`gpt-5-mini` vision) via the `openai` SDK · deployed on Vercel.

## Setup

```bash
pnpm install
cp .env.example .env.local   # then fill in values
```

`.env.local` variables:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Neon connection string. Use the `-pooler` host for serverless. |
| `AZURE_OPENAI_ENDPOINT` | OpenAI-compatible v1 endpoint, e.g. `https://<resource>.services.ai.azure.com/openai/v1` |
| `AZURE_OPENAI_API_KEY` | Azure AI resource key. Without it uploads fail unless `ALLOW_MOCK_EXTRACTOR=true` (explicit demo mode — never silent). |
| `AZURE_OPENAI_DEPLOYMENT` | Deployment name, e.g. `gpt-5-mini` (must support image input). |
| `ADMIN_PASSWORD` | Password for the admin login at `/admin` (the login is not linked anywhere public). |
| `AUTH_SECRET` | Session-cookie signing key: `openssl rand -hex 32` |

### Database

```bash
pnpm db:generate   # regenerate SQL after editing src/db/schema.ts
pnpm db:migrate    # apply migrations (drizzle/ folder) to DATABASE_URL
pnpm db:seed       # optional: demo stores/products/prices via the real ingestion pipeline
pnpm tsx scripts/db-check.ts   # sanity check: table row counts
```

### Run

```bash
pnpm dev     # http://localhost:3000
pnpm build && pnpm start
```

## How extraction works

1. `/upload` (admin only) — the browser downscales the photo (max 1800 px, JPEG) so it
   stays under serverless body limits, then POSTs it to `/api/receipts/extract`.
2. The route validates the file (jpg/png/webp, ≤ 8 MB) and hands the in-memory bytes to
   the extractor from `src/lib/ai/extractor.ts`. Nothing is written to disk.
3. `AzureOpenAIExtractor` sends the image + the prompt in `src/lib/ai/prompts.ts` to the
   vision model, which returns strict JSON: store, date, currency, and purchased items
   only (payment/VAT/terminal lines are ignored), already translated to English.
   The response is validated with Zod (`src/lib/ai/types.ts`), one retry on bad JSON.
   **Nothing is persisted yet** — the draft goes back to the upload page, where the
   admin reviews and edits every field (fix misread prices, remove non-product lines,
   add missing items) before saving via `POST /api/receipts/commit`.
4. `src/db/mutations/ingest-receipt.ts` normalizes each item
   (`src/lib/normalization/`):
   - deterministic `normalized_key` for deduplication —
     `"Valio Eila kevytmaitoj 1,75l"` → `valio_eila_light_milk_1_75_l`,
     `"GOHAR RIISI 5KG"` → `gohar_rice_5_kg`
   - match to an existing product by key, then by alias, else create it
   - weighted produce (onion, cauliflower…): the product is the item itself; the
     purchased weight and €/kg live on the observation
   - store the raw receipt text as a product alias
5. The response summarizes what was inserted/matched; an `extraction_runs` row records
   filename + counts + status for debugging (no receipt content).

Comparison logic: weighted products compare by **€/kg**, packaged products by exact
identity (brand + name + size). The product page shows latest price per store,
cheapest store, and history.

### Swapping the AI provider

Implement `ReceiptExtractor` (one method: `extractReceiptProducts`) in
`src/lib/ai/extractor.ts` and return it from `getExtractor()`. The rest of the app
only depends on the Zod-validated `ReceiptExtractionResult`.

## API

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/receipts/extract` | admin | multipart `file` → extraction draft (nothing persisted) |
| `POST /api/receipts/commit` | admin | reviewed/edited draft → persist products + observations (deletes the queued image if one was the source) |
| `POST /api/receipts/submit` | public | queue a receipt photo for admin review (validated, re-encoded, rate-limited) |
| `GET /api/receipts/pending` + `/[id]/image`, `POST /[id]/extract`, `DELETE /[id]` | admin | manage the submission queue |
| `GET /api/products?search=&page=` | public | product list with cheapest price + store count |
| `GET /api/products/:id` | public | latest price per store, history, aliases |
| `GET /api/stores`, `GET /api/stores/:id` | public | stores and their latest observed prices |
| `POST /api/auth/login` / `logout` | — | admin session cookie |

Route protection lives in `src/proxy.ts` (Next 16 proxy/middleware): unauthenticated
`/upload` redirects to `/admin`; `POST /api/receipts/*` returns 401.

## Deployment (Vercel + Neon, both free tiers)

The app is designed for Vercel Hobby + Neon free tier:

1. Import the GitHub repo at vercel.com (or `vercel deploy --prod` with the CLI).
2. Set the env vars above in Project Settings → Environment Variables
   (use the **pooler** `DATABASE_URL`).
3. Migrations are applied from your machine with `pnpm db:migrate` — Vercel only needs
   the connection string at runtime.
4. Extraction can take ~30 s; the route sets `maxDuration = 60`, supported on Hobby.

With the Git integration connected, every push to the production branch auto-deploys.

## Security notes

- Session: HMAC-signed JWT in an `httpOnly`, `secure`, `sameSite=lax` cookie (30 days).
- Login uses a constant-time password comparison and a delay on failure.
- **Rotate any credentials that were ever shared in chat/screenshots** (Neon password:
  Neon console → Roles; Azure key: Azure portal → resource → Keys; Vercel tokens).
- Secrets live only in `.env.local` / Vercel env vars — never committed.
