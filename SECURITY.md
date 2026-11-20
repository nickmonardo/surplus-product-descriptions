# Security

How this app protects access and data, what it stores, what it sends to whom, what a
security review in November 2026 found and fixed, and the risks we've knowingly accepted.
Written for Surplus Furniture's developer; questions to The Influence Agency (TIA).

## What it is

A Next.js 16 app on Vercel (team "TIA Team"). There is no database and no server of our own.

```text
Browser ──HTTPS──▶ Next.js on Vercel ──▶ Vercel Blob (private store): batches, decisions, to-dos
                        │
                        ├──▶ Windsor.ai API (read only): Surplus's Google Merchant Center product feed
                        ├──▶ Anthropic Claude API: product data in, draft copy out
                        ├──▶ Mailgun API: sign-in and "batch ready" emails
                        └──▶ teppermans.com (public pages, plain GET): competitor comparison
```

Magento is **not connected**. Approved copy leaves the app only as a CSV the client
downloads and imports themselves. See "Magento" below for how a future connection would work.

## What it stores

All in one private Vercel Blob store, readable only through the app's server code:

| Data | Contents |
| --- | --- |
| Batches | Product name, SKU, brand, URL, image URL, public product attributes and current description from the Merchant Center feed; the drafted copy; keyword choices; competitor excerpts |
| Decisions | Approved/edited/rejected copy, the reviewer's email address and the time |
| Magento to-do | Which details the developer checked off, the value entered, their email and the time |
| Sign-in records | SHA-256 hashes of used sign-in link ids and of addresses recently sent a link (for throttling); no addresses or tokens in clear |

No customer data, orders, prices paid, payment details or passwords are stored or handled.
Product data is already public on surplusfurniture.com.

## Who can sign in

- **Allowlist only.** An address can sign in if its domain is in `ALLOWED_DOMAINS` (TIA:
  `theinfluenceagency.com`) or the address is in `REVIEWER_EMAILS` (named Surplus reviewers,
  e.g. the developer). Anyone else gets the same "check your email" page and no email, so the
  form doesn't reveal who's on the list, by content or by timing (the email is sent after the
  response).
- **Passwordless email links.** Links are HMAC-SHA256 signed with `AUTH_SECRET` (32+
  characters), carry a random single-use id, and expire (15 minutes from the sign-in form,
  3 days in the weekly email). Opening a link only shows a **Continue** button; pressing it
  (a POST) uses the link, records its id, and starts the session. A second use is refused, and
  email security scanners that open links can neither use one nor burn it. The page with the
  token sends no referrer and isn't indexed.
- **Throttled.** One sign-in email per address per 2 minutes, so the form can't flood an inbox.
- **Sessions.** A signed cookie (`spd_session`), `HttpOnly`, `Secure`, `SameSite=Lax`, valid
  14 days. Every request re-checks the signature, the expiry and the allowlist, so removing an
  address ends that person's access at once, including sessions already open. Rotating
  `AUTH_SECRET` signs everyone out.
- **Roles.** TIA staff (by domain) can also run the weekly batch. Reviewers can approve, edit
  and reject copy, check off Magento to-dos, and download the approved CSV.

## How requests are protected

- Every page and API route except the sign-in pages checks the session server-side;
  signed-out requests get a redirect to sign-in or a 401.
- Every write (approve/edit/reject, to-do check-offs, running the batch, using a sign-in link)
  must come from the app's own pages: the `Origin` header must match, or `Sec-Fetch-Site` must
  be `same-origin`. JSON endpoints also require `Content-Type: application/json`. With the
  `SameSite=Lax` cookie, cross-site request forgery is blocked twice over.
- Request bodies are validated with zod, with length limits on every field.
- Batch ids, SKUs and to-do ids are checked against strict patterns before they become
  storage paths, so a crafted id can't reach other files.
- The weekly cron is authenticated with `CRON_SECRET` as a bearer token (compared in constant
  time); a signed-in TIA staff member can also start it from the dashboard.
- One rewrite per product at a time, so repeated clicks can't run up Claude usage.

## Content safety

- **Copy HTML** is limited to `p`, `ul`, `li` and `strong`, with no attributes. It is
  sanitized on the server when saved and again when shown. A test feeds it the usual XSS
  payloads (script, event handlers, `javascript:` links, SVG, iframes, styles, comments,
  malformed tags) and checks nothing else survives. Everything else on the page (names,
  notes, values, competitor excerpts) is rendered as text by React.
- **Links and images** from the feed or competitor pages must be plain `http(s)` URLs, or they
  aren't shown.
- **The CSV export** drops a leading `=`, `+`, `@`, tab or carriage return from every cell, so
  the file can't run spreadsheet formulas if someone opens it in Excel.
- **AI output** passes the same fact checks (no numbers or claims missing from the product
  data, no prices, no competitor names) and the sanitizer, and a person approves every piece
  of copy before it can be exported.

## HTTP headers

Every page is sent with a Content Security Policy carrying a fresh nonce per request
(`src/proxy.ts`):

```text
default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'; style-src 'self' 'nonce-…'
https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; font-src 'self'
https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self'; object-src 'none';
base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```

and every response (`next.config.ts`) with `Strict-Transport-Security`,
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy` and
`Cross-Origin-Opener-Policy: same-origin`. The `X-Powered-By` header is off.

## Secrets

Kept in Vercel environment variables, never in the repository, never logged.
`ANTHROPIC_API_KEY`, `MAILGUN_API_KEY`, `AUTH_SECRET` and `CRON_SECRET` are stored as
Vercel "sensitive" values, which can't be read back. `BLOB_READ_WRITE_TOKEN` was created by
Vercel when the store was connected. The repository is private on GitHub.

| What each third party receives | |
| --- | --- |
| Anthropic (Claude API) | Product data from the feed and the copy being revised; no reviewer data. By default, Anthropic doesn't train its models on API data. |
| Mailgun | The recipient's email address and the email (with its sign-in link) |
| Windsor.ai | Our API key; it returns the feed (read only) |
| teppermans.com | A plain search request for a keyword, identified as this app |

## Review, November 2026: found and fixed

| Finding | Fix |
| --- | --- |
| Dependencies had published advisories (Next.js 16.2.3, including critical; zod; a transitive zod in Vercel's storage client) | Next.js 16.4.6, zod 4.6.7 (forced for the transitive copy too), @vercel/blob 2.9.0; `npm audit` reports 0 vulnerabilities |
| After sign-in, a crafted return path (`/\evil.com`) could redirect to another site | One strict check (`safeNext()`), parsed against the site's origin, used everywhere |
| Sign-in links could be reused until they expired (up to 3 days) | Single-use links with a Continue step |
| The sign-in form could send an allowed address unlimited emails | One email per address per 2 minutes |
| No Content Security Policy or security headers | Nonce-based CSP and the headers above |
| Writes accepted requests with no `Origin` header | `Origin` or `Sec-Fetch-Site` must show the same site; JSON required |
| Feed URLs went into links unchecked | `http(s)` only |
| CSV cells could start with a formula | Leading formula characters removed |
| A rewrite could be started repeatedly | One running rewrite per product |

Each fix has a test in `tests/security.test.mjs` or was checked in a browser against a
production build (sign-in, single use, replay, redirects, framing, cross-site writes).

## Known limitations (accepted)

- **Sessions can't be revoked one at a time.** There's no session store. To cut someone off,
  remove their address (immediate) or rotate `AUTH_SECRET` (signs everyone out). Signing out
  clears the cookie on that device.
- **No general rate limiting** beyond the sign-in email throttle. Every route needs a session
  except sign-in itself. Vercel's firewall can add per-IP limits if wanted.
- **The HTML sanitizer is our own**, a strict allowlist of four tags without attributes,
  rather than a library such as DOMPurify. It is small and tested against common payloads,
  and the CSP stops injected scripts from running even if one got through.
- **Preview deployments share production's storage and sign-in secret.** Previews require a
  Vercel team login (Vercel SSO), and nothing is deployed from branches today.
- **The Blob storage token** can be read by members of the TIA Team on Vercel (Vercel flags
  it as a readable secret). Team membership is limited to TIA staff.
- **All reviewers have the same rights.** Anyone on the allowlist can approve, edit or reject
  copy and check off to-dos. Who did what is recorded with each decision.
- **Prompt injection.** Product text from the feed goes to Claude. The output can't carry
  markup or claims past the checks, and nothing is published without a person's approval.

## Magento (not connected yet)

When the client provides write access, the plan is:

- A Magento **integration token scoped to catalog products** (write access to description,
  meta title and meta description only, if their setup allows), stored as a Vercel sensitive
  environment variable.
- Only copy a reviewer approved is written, one product at a time, with the reviewer, time
  and previous value recorded so a change can be traced and undone.
- No customer, order or admin-user access is requested.

## Checking it yourself

```bash
npm ci && npm audit          # 0 vulnerabilities
npm test                     # includes tests/security.test.mjs
npm run build
curl -sI https://surplus-product-descriptions.vercel.app/login   # security headers and CSP
```

The sign-in code is in `src/lib/tokens.ts`, `src/lib/auth.ts`, `src/app/api/auth/` and
`src/app/auth/verify/`; request checks in `src/lib/request-guard.ts`; headers in
`src/proxy.ts` and `next.config.ts`; the sanitizer is `sanitizeCopyHtml()` in
`src/lib/copy/rules.ts`.

## Reporting a problem

Email TIA at the address you were given for this project. Please don't open a public issue.
