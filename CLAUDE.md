# CLAUDE.md

Surplus product descriptions: a Next.js 16 app on Vercel that drafts SEO product copy for
Surplus Furniture each week and lets the client review it. Read `README.md` first.

## Rules

- **Commits** are authored `TIA-Rocco <rocco@theinfluenceagency.com>`.
- **Nothing is made up.** Drafts and FAQs may only state facts in the product's data or its
  current description. `validateDraft()` / `validateFaq()` in `src/lib/copy/rules.ts` enforce
  this; add a rule there (with a test) rather than relaxing one. Missing facts go to
  `faq_gaps` / `reviewer_notes` for the client, never into the copy.
- **Confirmed details are facts.** A Magento to-do value the developer enters becomes a product
  attribute for the rewrite; nothing else is added. Rewrites live in `revisions/` and
  check-offs in `fixes/`, never inside the batch file, so concurrent saves can't overwrite it.
- **Copy rules** (prompt, schema, limits, banned and guarded claims) live only in `rules.ts`.
  Keyword data lives only in `keywords.ts`, dated in its header; record the source and date
  when you add terms.
- **HTML** in copy is `p`, `ul`, `li`, `strong` only. Anything saved goes through
  `sanitizeCopyHtml()` on the server.
- **Auth:** every route that reads or writes batches checks `currentUser()`; write routes also
  check the request origin. TIA staff (`isStaff()`) alone can run the pipeline. Never log
  sign-in links in production.
- **Storage** is private Vercel Blob (`src/lib/storage.ts`); keys are validated
  (`isBatchId`, `isSku`) before they become paths.
- **Competitor pages** are read with plain GET requests that identify the app. If a site
  refuses (403, bot protection), skip it; don't work around it.
- Next.js 16: route `params`/`searchParams` and `cookies()` are async. Read
  `node_modules/next/dist/docs/` before changing a Next API.

## Layout

```text
src/lib/copy/        pure rules: keywords.ts, rules.ts, questions.ts, magento-export.ts,
                     data-asks.ts (the Magento to-do list)
src/lib/feed/        windsor.ts (Merchant Center via Windsor)
src/lib/competitors/ teppermans.ts
src/lib/             draft.ts (Claude), pipeline.ts (weekly run), rewrite.ts (rewrite after a
                     to-do is checked off), select.ts, batches.ts,
                     storage.ts, tokens.ts + auth.ts (sign-in), mail.ts (Mailgun)
src/app/             dashboard pages, components/ReviewBoard.tsx, api/ routes
data/seed-batch.json the first (prototype) batch
tests/               node --test, loading the TS modules with the TypeScript transpiler
```

## Before handoff

`npm test`, `npm run lint`, `npm run build`. Pure modules (anything under `src/lib/copy`,
`feed`, `competitors`, `select.ts`, `tokens.ts`) must stay free of `server-only` and Next
imports so the tests can load them.
