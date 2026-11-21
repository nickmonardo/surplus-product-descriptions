# Dashboard design guide

The clean, solid-colour look of the Surplus product descriptions dashboard, written so it can
be applied to any TIA dashboard. The live reference is
`src/app/globals.css` in this repo; a copy-paste starter is at the end.

## Principles

1. **Quiet surfaces, one accent.** White cards on a light grey page, thin grey borders. TIA
   pink is used sparingly, only where it means something: the main action, the selected
   thing, the one figure that matters.
2. **Solid colours only.** No gradients, glows, frosted glass, decorative circles or
   coloured shadows anywhere.
3. **Borders, not shadows.** Separation comes from 1px lines and spacing. No drop shadows,
   no thick coloured left edges on cards.
4. **Sentence case.** Headings, buttons, tabs and labels are written normally ("Review
   products", "Save and approve"), never in spaced-out capitals.
5. **Light type.** Regular to semibold. Nothing extra-bold.
6. **Status colours mean status.** Green is good or approved, amber is waiting or needs a
   look, red is a problem or rejected. Pink is never used to mean "bad".
7. **One thing at a time.** Long lists of big items become one item per screen with a stepper
   (Previous · numbered dots · Next). Secondary detail goes behind tabs or a "Show" toggle.

## Colour

| Token | Value | Use |
| --- | --- | --- |
| `--tia-pink` | `#FF1177` | Primary buttons, selected tab underline, current-step outline, target figure/keyword chip, brand dot |
| `--tia-pink-deep` | `#D90062` | Hover on pink buttons; pink text on light backgrounds |
| `--tia-pink-soft` | `#FFF0F6` | Rare highlight backgrounds (your own row in a comparison table) |
| `--ink` | `#1F1F1F` | Body text, headings, selected filter pill background |
| `--ink-2` | `#4A4A4A` | Secondary text, intro paragraphs |
| `--muted` | `#6B6B6B` | Labels, captions, meta lines, counts |
| `--line` | `#E6E6E6` | Card borders, dividers between rows |
| `--line-strong` | `#D4D4D4` | Button and input borders, hover borders |
| `--page` | `#F6F6F7` | Page background |
| `--surface` | `#FFFFFF` | Cards, top bar, page header |
| `--surface-2` | `#FAFAFA` | Toolbars inside cards, table headers, "before" panes |
| `--ok` / `--ok-soft` | `#1D7A45` / `#E7F5ED` | Approved, done, healthy |
| `--warn` / `--warn-soft` | `#8A6A00` / `#FFF7D6` | To review, notes, in progress |
| `--bad` / `--bad-soft` | `#C2213A` / `#FDECEF` | Rejected, errors, failed |
| `--link` | `#1A4CB0` | Text links (underlined) |

Status pills and notices use the soft colour as background and the strong colour as text.
Solid green and red fills are kept for the Approve button and done/rejected step dots.

## Type

- **Font:** Poppins (Google Fonts), weights 400, 500 and 600. Fallback `"Segoe UI", system-ui, sans-serif`.
- **Body:** 14px, line-height 1.6, tabular numbers (`font-variant-numeric: tabular-nums`).
- **Page title (h1):** `clamp(24px, 3.4vw, 30px)`, weight 600, letter-spacing -0.01em.
- **Section title (h2) and card title (h3):** 16px, weight 600.
- **Labels and pane titles:** 12px, weight 600, `--muted`, sentence case.
- **Meta lines and captions:** 12–13px, `--muted`.
- **Long reading text** (the copy being reviewed): 15px, line-height 1.7.
- **Big figures** in the page header: 24px, weight 600, with a 12px muted label underneath.

## Layout

- Content column: max width 1100px, centred, 20px side gutters (respecting the safe area on phones).
- Vertical rhythm: 16px between blocks on a page, 24px top padding.
- Radius: 10px for cards and large boxes, 8px for buttons, inputs and small boxes, fully
  round for pills and chips.
- Below 780px: two-column areas stack, the header figures move under the title, the top-bar
  navigation wraps to its own row. Below 480px: hide the signed-in email, shrink the logo.
- No horizontal scrolling at phone width. Wide tables scroll inside their own bordered box.

## Components

**Top bar.** White, sticky, 1px `--line` bottom border, no shadow. Left: a 12px pink dot,
"The Influence Agency" (14px/600) and the product name (13px muted, after a thin divider).
Then section links (13px; current page is semibold on a `--page` grey background, 8px
radius). Right: client logo (30px tall), signed-in email and a "Sign out" text link.

**Page header** (replaces any coloured banner). A white band under the top bar with a 1px
bottom border. Left: a small muted label ("Client · Context"), the h1, one or two lines of
intro in `--ink-2`. Right: three or four plain figures (24px number, 12px muted label), no
boxes around them.

**Card.** White, 1px `--line` border, 10px radius, no shadow. Header row: optional 60px
image (8px radius, bordered), title, then a muted meta line. Sections inside a card are
separated by 1px lines, not gaps. A status pill sits top right.

**Buttons.** 13px/600, 8px radius, 8×16px padding, sentence case.
- Default: white with a `--line-strong` border.
- Primary: solid pink, white text (hover: deep pink).
- Approve: solid green. Reject: white with red text.
- Link button: no border, underlined muted text.
- One primary button per area.

**Filter pills** (All · To review · Approved). Round, 13px, white with a `--line` border and
a muted count. Selected: solid `--ink` background, white text.

**Tabs inside a card.** 13px muted text with a 2px underline. Selected: `--ink` text, weight
600, pink underline.

**Status pills.** Round, 12px/500, soft background with strong text. Tags (e.g. "Thin
description") are 6px-radius chips with a light border.

**Stepper** (one item at a time). A bordered white bar: Previous button, numbered 28px
round dots (white; green or red fill when decided; the current one gets a 2px pink outline),
"Product 3 of 10", then a pink Next button. Sticky on desktop; on phones Previous and Next
share a row with the dots below. Left and right arrow keys move between items.

**Notices.** Rounded 8px boxes in the soft status colours (amber note, red error, green
saved). Short, one or two lines.

**Tables.** Inside a bordered 8px box. Header row on `--surface-2` with 12px muted
semibold labels. Rows separated by 1px lines. Highlight your own row with `--tia-pink-soft`.

**Forms.** Labels 13px/600 above fields. Inputs: white, 1px `--line-strong` border, 8px
radius; on focus a pink border plus a soft 3px pink ring (`rgba(255, 17, 119, 0.12)`).

**Collapsible helper.** A card whose header reads "How it works" with a muted "Show ▾" /
"Hide ▴" on the right.

**Footer.** A 1px top border, a small pink dot with "The Influence Agency" in muted text on
the left, the product line on the right.

## Don't

- Gradients of any kind, including on buttons, headers, dividers or text.
- Drop shadows, glows, blur or glass effects.
- All-caps or letter-spaced labels, or weights above 600.
- Pink for errors, warnings or "rejected".
- More than one primary (pink) button in the same area.
- Coloured bars on the edges of cards to show status (use the pill).
- Decorative shapes, emoji or ornaments (✦) in headings.

## Accessibility

- Contrast (WCAG AA needs 4.5:1 for normal text): ink on page 15.3, muted on white 5.3, muted
  on page grey 4.9, links 7.8, green/amber/red on their soft backgrounds 4.8 / 4.7 / 5.2, white
  on green 5.4, deep pink on white 5.1. All pass.
- **The one exception: white on TIA pink is 3.75:1.** That passes for large text (24px, or
  19px bold) but not for 13px button labels. It's the brand pairing and we accept it on
  primary buttons; where strict AA matters (public or government-facing work), fill primary
  buttons with `--tia-pink-deep` (`#D90062`, 5.1:1) instead.
- Don't put `--muted` text smaller than 12px.
- Every control gets a visible focus outline: 2px pink, offset 2px.
- Status is never colour alone: pills carry words, and dots carry numbers plus an accessible label.
- Respect `prefers-reduced-motion`: no spinners or transitions when it's set.

## Starter CSS

Paste into a dashboard's global stylesheet, load Poppins (400, 500, 600), and use these
class names (or map them onto your component library's tokens).

```css
:root {
  --tia-pink: #ff1177; --tia-pink-deep: #d90062; --tia-pink-soft: #fff0f6;
  --ink: #1f1f1f; --ink-2: #4a4a4a; --muted: #6b6b6b;
  --line: #e6e6e6; --line-strong: #d4d4d4;
  --page: #f6f6f7; --surface: #ffffff; --surface-2: #fafafa;
  --ok: #1d7a45; --ok-soft: #e7f5ed; --warn: #8a6a00; --warn-soft: #fff7d6; --bad: #c2213a; --bad-soft: #fdecef;
  --link: #1a4cb0; --radius: 10px; --radius-sm: 8px;
  --font: "Poppins", "Segoe UI", system-ui, sans-serif;
  color-scheme: light;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--page); color: var(--ink); font: 14px/1.6 var(--font); font-variant-numeric: tabular-nums; }
h1, h2, h3 { margin: 0; font-weight: 600; letter-spacing: -0.01em; }
a { color: var(--link); text-underline-offset: 2px; }
:focus-visible { outline: 2px solid var(--tia-pink); outline-offset: 2px; }
.muted { color: var(--muted); font-size: 13px; }

/* Top bar */
.topbar { position: sticky; top: 0; z-index: 100; background: var(--surface); border-bottom: 1px solid var(--line);
  display: flex; align-items: center; justify-content: space-between; gap: 10px 24px; flex-wrap: wrap; padding: 10px 20px; }
.brand { display: flex; align-items: center; gap: 10px; color: var(--ink); text-decoration: none; }
.brand-mark { width: 12px; height: 12px; border-radius: 50%; background: var(--tia-pink); }
.brand-name { font-weight: 600; }
.brand-product { font-size: 13px; color: var(--muted); border-left: 1px solid var(--line); padding-left: 10px; }
.topnav { display: flex; gap: 2px; margin-right: auto; }
.topnav a { font-size: 13px; font-weight: 500; color: var(--muted); text-decoration: none; padding: 6px 12px; border-radius: var(--radius-sm); }
.topnav a[aria-current="page"] { color: var(--ink); background: var(--page); font-weight: 600; }

/* Page header */
.page-head { background: var(--surface); border-bottom: 1px solid var(--line); }
.page-head-inner { max-width: 1100px; margin: 0 auto; padding: 28px 20px 24px; display: grid; gap: 8px 32px;
  grid-template-columns: minmax(0, 1fr) auto; align-items: end; }
.page-head .eyebrow { font-size: 12px; font-weight: 500; color: var(--muted); }
.page-head h1 { font-size: clamp(24px, 3.4vw, 30px); line-height: 1.2; }
.page-head .intro { max-width: 70ch; color: var(--ink-2); }
.figures { display: flex; gap: 28px; grid-column: 2; grid-row: 1 / span 3; align-self: end; }
.figure { display: grid; font-size: 12px; color: var(--muted); line-height: 1.3; }
.figure strong { font-size: 24px; font-weight: 600; color: var(--ink); }

/* Page and cards */
.page { max-width: 1100px; margin: 0 auto; display: grid; gap: 16px; padding: 24px 20px 56px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
.card-head { padding: 16px 20px; display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; border-bottom: 1px solid var(--line); }
.card-head h3 { font-size: 16px; }
.card-section { padding: 18px 20px; }
.card-section + .card-section { border-top: 1px solid var(--line); }
.label { font-size: 12px; font-weight: 600; color: var(--muted); }

/* Buttons */
.btn { border-radius: var(--radius-sm); padding: 8px 16px; font: 600 13px var(--font); border: 1px solid var(--line-strong);
  background: var(--surface); color: var(--ink); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.btn:hover { background: var(--surface-2); border-color: #bdbdbd; }
.btn:disabled { opacity: 0.5; }
.btn.primary { background: var(--tia-pink); border-color: var(--tia-pink); color: #fff; }
.btn.primary:hover { background: var(--tia-pink-deep); border-color: var(--tia-pink-deep); }
.btn.approve { background: var(--ok); border-color: var(--ok); color: #fff; }
.btn.reject { color: var(--bad); }
.btn.link { border: none; background: none; color: var(--muted); text-decoration: underline; padding: 8px 4px; font-weight: 500; }

/* Filter pills, tabs, status */
.filter { font-size: 13px; font-weight: 500; padding: 6px 12px; border-radius: 100px; border: 1px solid var(--line); background: var(--surface); color: var(--ink-2); }
.filter[aria-pressed="true"] { background: var(--ink); border-color: var(--ink); color: #fff; }
.tabs { display: flex; gap: 4px; padding: 0 20px; border-bottom: 1px solid var(--line); overflow-x: auto; }
.tabs button { background: none; border: none; border-bottom: 2px solid transparent; padding: 11px 10px 9px; margin-bottom: -1px; font: 500 13px var(--font); color: var(--muted); }
.tabs button[aria-selected="true"] { color: var(--ink); font-weight: 600; border-bottom-color: var(--tia-pink); }
.pill { font-size: 12px; font-weight: 500; padding: 3px 10px; border-radius: 100px; white-space: nowrap; }
.pill.ok { background: var(--ok-soft); color: var(--ok); }
.pill.warn { background: var(--warn-soft); color: var(--warn); }
.pill.bad { background: var(--bad-soft); color: var(--bad); }
.notice { font-size: 13px; border-radius: var(--radius-sm); padding: 9px 12px; background: var(--warn-soft); color: var(--warn); }

/* Tables and forms */
.table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius-sm); }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th { background: var(--surface-2); color: var(--muted); text-align: left; font-size: 12px; font-weight: 600; padding: 9px 12px; border-bottom: 1px solid var(--line); }
td { padding: 10px 12px; border-bottom: 1px solid var(--line); }
tr:last-child td { border-bottom: none; }
input, textarea, select { font: 14px var(--font); color: var(--ink); background: var(--surface); border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 8px 12px; }
input:focus, textarea:focus, select:focus { border-color: var(--tia-pink); outline: none; box-shadow: 0 0 0 3px rgba(255, 17, 119, 0.12); }

@media (max-width: 780px) {
  .page-head-inner { grid-template-columns: minmax(0, 1fr); }
  .figures { grid-column: 1; grid-row: auto; gap: 24px; margin-top: 6px; }
  .topnav { order: 3; width: 100%; margin-right: 0; }
  .brand-product { display: none; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
```

## Using it with Claude

To restyle another dashboard, give Claude this file and say: "Apply DESIGN.md: solid colours
only, keep everything working, show me before and after screenshots before deploying."
