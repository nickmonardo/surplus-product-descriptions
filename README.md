# Surplus product descriptions

Every week this app finds Surplus Furniture products with new or thin descriptions, drafts
an SEO description, meta title, meta description and FAQ for each, and puts them on a review
dashboard where the client approves, edits or rejects them.

## How it works

1. **Find products.** The weekly run (Vercel cron, Mondays 12:47 UTC) reads Surplus's Google
   Merchant Center feed through Windsor.ai. It picks products added since the last batch
   (newest first), then products whose description is missing or under 40 words. A product
   is drafted once; after that it waits for review.
2. **Pick keywords.** `src/lib/copy/keywords.ts` matches each product to a category and picks
   a target keyword from Google.ca search volumes (Semrush), preferring a product-specific
   term ("twin over twin bunk bed") over the head term ("bunk beds").
3. **Draft.** Claude writes the description, meta tags and FAQ from the product's own data
   (`src/lib/draft.ts`, rules and prompt in `src/lib/copy/rules.ts`).
4. **Check.** Every draft is validated: length, allowed HTML, meta lengths, keyword placement,
   no number that isn't in the product data, no unsupported claims (warranty, solid wood,
   made in, weight capacity...), no prices, delivery promises, superlatives or competitor
   names. A failing draft is sent back once with the problems listed.
5. **Compare.** The closest Tepperman's product is looked up for the same keyword, and the
   dashboard shows how its copy compares (words, dimensions, keyword use) and which specs it
   states that Surplus's listing lacks.
6. **Review.** Reviewers get an email with a sign-in link. Approved copy (with any edits) is
   saved with who approved it and when, and can be downloaded as a Magento import file.
7. **Magento to-do.** Details the feed lacks that would improve the copy (drawer count,
   mattress size, dimensions, weight capacity, care, answers to shopper questions) are listed
   at `/magento` for Surplus's developer, each with why it matters and the keyword it unlocks
   (`src/lib/copy/data-asks.ts`). Checking one off with the value added in Magento makes that
   value a product fact and rewrites the description in the background (`src/lib/rewrite.ts`):
   the rewrite keeps the copy the client last approved or edited, works the new detail in,
   re-picks the keyword, passes the same checks, and sends the product back to "To review".

## Using it

- **Review:** open the batch from the email (or sign in at `/login` with your email).
  Approve, Edit (change the description, FAQ, meta title and meta description in place) or
  Reject with a note. Undo puts a product back to "To review".
- **Apply to the site:** on a batch with approvals, **Download approved copy (Magento CSV)**.
  In Magento: System → Data Transfer → Import, entity type Products, import behaviour
  Add/Update, upload the file. Columns: `sku, description, meta_title, meta_description`
  (the FAQ is appended to the description).
- **Magento to-do (developer):** add the developer's email to `REVIEWER_EMAILS`. They
  open **Magento to-do**, add each detail in Magento, then enter what they added and press
  **Done** (or **Doesn't apply**). The description is rewritten in about a minute and shows
  up in the review list with a note saying which details it now uses. **Reopen** undoes a
  check-off; enter a corrected value to rewrite again.
- **Run now (TIA staff):** the dashboard home has **Check feed** (lists what would be drafted)
  and **Run this week's batch now**.

## Deploying on Vercel

1. Import this repository as a new Vercel project (framework: Next.js).
2. **Storage → Create → Blob**, connect it to the project. This sets `BLOB_READ_WRITE_TOKEN`.
3. Set the environment variables below (Production), then deploy.
4. Mailgun: the sending domain (`mg.theinfluenceagency.com`) must be verified in Mailgun.

| Variable | What it is |
| --- | --- |
| `AUTH_SECRET` | 32+ random characters for signing links and sessions (`openssl rand -base64 48`). Changing it signs everyone out. |
| `ALLOWED_DOMAINS` | Email domains that can sign in (default `theinfluenceagency.com`). These people count as TIA staff. |
| `REVIEWER_EMAILS` | Individual reviewer addresses outside those domains (the Surplus team), comma-separated. |
| `NOTIFY_EMAILS` | Who gets the weekly "ready for review" email. Each must also be allowed above. |
| `APP_URL` | Public URL for emailed links (defaults to the Vercel production URL). |
| `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAIL_FROM` | Email delivery. |
| `CRON_SECRET` | Vercel sends it to the cron route as a bearer token (16+ characters). |
| `WINDSOR_API_KEY` | Windsor.ai API key with access to the Merchant Center account. |
| `MERCHANT_ACCOUNT_ID` | Surplus's Merchant Center account (default `743756928`). |
| `ANTHROPIC_API_KEY` | Claude API key. |
| `MAX_PRODUCTS_PER_RUN` | Products drafted per week (default 12). |
| `PIPELINE_RESEARCH` | `1` lets Claude search the web for the exact product (slower). |

The run stops starting new products after about 3.5 minutes so it ends inside the 5-minute
function limit; anything left is picked up next week.

## Local development

```bash
npm install
cp .env.example .env.local   # set AUTH_SECRET at least
npm run dev
```

Without `BLOB_READ_WRITE_TOKEN`, data is written to `./.data`. Without Mailgun settings,
sign-in emails are printed to the dev server's console instead of sent. The first batch
(the November 2026 prototype's ten products) ships in `data/seed-batch.json`, so the
dashboard has something to review before the first weekly run.

```bash
npm test        # unit tests (keywords, rules, sanitizer, tokens, feed, selection, competitor parsing)
npm run lint
npm run build
```

## Security notes

- Sign-in links and sessions are HMAC-signed and expire (links: 15 minutes from the sign-in
  page, 3 days in the weekly email; sessions: 14 days). With no database, a link is not
  single-use: anyone holding an unexpired link can sign in, so don't forward the emails.
- Removing an address from `REVIEWER_EMAILS` (or its domain from `ALLOWED_DOMAINS`) ends that
  person's access immediately, including existing sessions.
- Edited copy is sanitized on the server to `p`, `ul`, `li` and `strong` only.
- Blob storage is private; batches and decisions are only readable through the app.

## Not yet

- **Magento API:** approved copy is exported as CSV today. Writing it straight to the product
  (keeping the previous description for undo) needs a Magento integration token from Surplus.
- Keyword volumes are a snapshot (Semrush, Oct–Nov 2026) in `keywords.ts`; refresh them when
  categories change.
