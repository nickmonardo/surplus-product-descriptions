// Pure rules for Surplus Furniture product descriptions: the facts Claude may
// use, the prompt and output schema, and the checks every draft must pass
// before a person reviews it. No network or database access here.
import type { KeywordPlan } from "./keywords";

export const DRAFT_MODEL = "claude-opus-5-5";

export interface ProductInput {
  sku: string;
  name: string;
  url?: string;
  brand?: string;
  categories?: string[];
  attributes?: Record<string, string | number | null | undefined>;
  currentDescription?: string;
  createdAt?: string;
}

export interface ProductDraft {
  description_html: string;
  meta_title: string;
  meta_description: string;
  keywords_used: string[];
  research_sources: string[];
  reviewer_notes: string;
  faq?: FaqItem[];
  faq_gaps?: FaqGap[];
}

export interface FaqItem {
  q: string;
  a: string;
}

/** A question shoppers ask that the product data cannot answer yet. */
export interface FaqGap {
  q: string;
  why: string;
}

export const LIMITS = {
  minWords: 70,
  maxWords: 180,
  metaTitleMax: 60,
  metaDescriptionMin: 110,
  metaDescriptionMax: 160,
  thinWords: 40,
};

const ALLOWED_TAGS = new Set(["p", "ul", "li", "strong"]);

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(text: string): number {
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

/** Attribute pairs worth showing Claude: no empty values, no Magento housekeeping. */
export function productFacts(product: ProductInput): Record<string, string> {
  const facts: Record<string, string> = { name: product.name, sku: product.sku };
  if (product.brand) facts.brand = product.brand;
  if (product.categories?.length) facts.categories = product.categories.join(" | ");
  for (const [key, value] of Object.entries(product.attributes ?? {})) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (!text) continue;
    facts[key] = text;
  }
  return facts;
}

const NUMBER_RE = /\d+(?:[.,]\d+)*(?:\s*\/\s*\d+)?/g;

function normalizeNumber(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/,(?=\d{3}\b)/g, "").replace(/\.0+$/, "");
}

function numbersIn(text: string): string[] {
  return (text.match(NUMBER_RE) ?? []).map(normalizeNumber);
}

/** The product's facts plus its current description: the client's own copy counts as data. */
function factSources(product: ProductInput): string[] {
  return [...Object.values(productFacts(product)), stripHtml(product.currentDescription ?? "")];
}

/** Every number a draft may state: those in the product's own data and chosen keywords. */
export function allowedNumbers(product: ProductInput, plan?: KeywordPlan): Set<string> {
  const sources = factSources(product);
  if (plan?.primary) sources.push(plan.primary.keyword);
  for (const entry of plan?.secondary ?? []) sources.push(entry.keyword);
  const allowed = new Set<string>();
  for (const source of sources) {
    for (const n of numbersIn(source)) {
      allowed.add(n);
      // "60x80" style dimensions and fractions also allow their parts.
      for (const part of n.split(/[/.]/)) if (part) allowed.add(part);
    }
  }
  return allowed;
}

// Claims a draft may only make when the product's facts say so.
const GUARDED_CLAIMS: { label: string; pattern: RegExp; factPattern: RegExp }[] = [
  { label: "warranty", pattern: /\bwarrant(y|ies|ed)\b|\bguarantee/i, factPattern: /\bwarrant|\bguarantee/i },
  { label: "made in", pattern: /\b(made|crafted|built) in\b|\bcanadian[- ]made\b/i, factPattern: /\bmade in\b|\bcanadian[- ]made\b|\bcountry\b/i },
  { label: "solid wood", pattern: /\bsolid (wood|oak|pine|maple|birch|acacia)\b/i, factPattern: /\bsolid\b/i },
  { label: "assembly", pattern: /\bassembl(y|ed|es)\b|\bno tools\b/i, factPattern: /\bassembl/i },
  { label: "eco claim", pattern: /\b(eco[- ]?friendly|sustainab\w*|non[- ]toxic|organic|certipur)\b/i, factPattern: /\b(eco|sustainab|non[- ]?toxic|organic|certipur)/i },
  { label: "stain or water resistance", pattern: /\b(stain|water|spill|scratch|pet)[- ]?(resistant|proof|repellent)\b/i, factPattern: /\bresist|\bproof|\brepellent/i },
  { label: "weight capacity", pattern: /\b(weight (capacity|limit)|holds up to|supports up to)\b/i, factPattern: /\b(capacity|weight limit|max(imum)? weight)\b/i },
];

// Never allowed: prices and promotions change, competitors and superlatives invite trouble.
const BANNED: { label: string; pattern: RegExp }[] = [
  { label: "price or promotion", pattern: /\$\s?\d|\b(sale|on sale|% off|discount(ed)?|clearance|deal|lowest price|financing)\b/i },
  { label: "delivery promise", pattern: /\bfree (shipping|delivery)\b|\bships? (in|within)\b|\bnext[- ]day\b/i },
  { label: "superlative", pattern: /\b(best|#1|number one|unbeatable|world[- ]class|perfect for everyone)\b/i },
  { label: "competitor", pattern: /\b(ikea|wayfair|amazon|the brick|leon'?s|structube|costco|ashley homestore)\b/i },
  { label: "stock or store availability", pattern: /\b(in stock|limited stock|while supplies last|available (at|in) (all|every))\b/i },
];

function containsKeyword(text: string, keyword: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
  const haystack = ` ${norm(text)} `;
  const needle = norm(keyword);
  const variants = new Set([needle, needle.replace(/s$/, ""), `${needle}s`, needle.replace(/\bsofa\b/, "couch"), needle.replace(/\bcouch\b/, "sofa")]);
  return [...variants].some((v) => haystack.includes(` ${v} `) || haystack.includes(` ${v}s `));
}

export interface DraftIssue {
  code: string;
  message: string;
}

export function validateDraft(draft: ProductDraft, product: ProductInput, plan: KeywordPlan): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const add = (code: string, message: string) => issues.push({ code, message });
  const body = stripHtml(draft.description_html);
  const words = wordCount(body);
  if (words < LIMITS.minWords || words > LIMITS.maxWords)
    add("length", `Description is ${words} words; aim for ${LIMITS.minWords}–${LIMITS.maxWords}.`);

  for (const match of draft.description_html.matchAll(/<\/?\s*([a-z0-9]+)[^>]*>/gi)) {
    const tag = match[1].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) add("html", `Tag <${tag}> is not allowed (use p, ul, li, strong).`);
  }
  if (/<[^>]+\s(style|class|on\w+)\s*=/i.test(draft.description_html))
    add("html", "Description has inline attributes; tags must be bare.");

  if (draft.meta_title.length > LIMITS.metaTitleMax)
    add("meta_title", `Meta title is ${draft.meta_title.length} characters; keep it to ${LIMITS.metaTitleMax}.`);
  const metaLen = draft.meta_description.length;
  if (metaLen < LIMITS.metaDescriptionMin || metaLen > LIMITS.metaDescriptionMax)
    add("meta_description", `Meta description is ${metaLen} characters; aim for ${LIMITS.metaDescriptionMin}–${LIMITS.metaDescriptionMax}.`);

  if (plan.primary) {
    const firstParagraph = stripHtml(draft.description_html.split(/<\/p>/i)[0] ?? "");
    if (!containsKeyword(firstParagraph, plan.primary.keyword))
      add("keyword", `Primary keyword "${plan.primary.keyword}" is not in the first paragraph.`);
    if (!containsKeyword(`${draft.meta_title} ${draft.meta_description}`, plan.primary.keyword))
      add("keyword", `Primary keyword "${plan.primary.keyword}" is not in the meta title or description.`);
  }

  const allowed = allowedNumbers(product, plan);
  const allText = `${body} ${draft.meta_title} ${draft.meta_description}`;
  const unsupported = [...new Set(numbersIn(allText))].filter(
    (n) => !allowed.has(n) && !n.split(/[/.]/).every((part) => allowed.has(part)),
  );
  if (unsupported.length)
    add("unsupported_number", `Numbers not in the product data: ${unsupported.join(", ")}. Dimensions and specs must come from Magento.`);

  const factsText = factSources(product).join(" ");
  for (const claim of GUARDED_CLAIMS) {
    if (claim.pattern.test(allText) && !claim.factPattern.test(factsText))
      add("unsupported_claim", `Mentions ${claim.label}, which the product data does not state.`);
  }
  for (const rule of BANNED) {
    if (rule.pattern.test(allText)) add("banned", `Mentions ${rule.label}.`);
  }
  return issues;
}

export type CopyReason = "missing" | "thin" | "new";

/** Why a product needs copy: no description, a thin one, or created since the last run. */
export function copyReasons(product: ProductInput, since?: string): CopyReason[] {
  const reasons: CopyReason[] = [];
  const words = wordCount(stripHtml(product.currentDescription ?? ""));
  if (words === 0) reasons.push("missing");
  else if (words < LIMITS.thinWords) reasons.push("thin");
  if (since && product.createdAt && product.createdAt.slice(0, 10) >= since.slice(0, 10)) reasons.push("new");
  return reasons;
}

export const DRAFT_SYSTEM = `You write product descriptions for Surplus Furniture & Mattress Warehouse, a value-focused Canadian furniture and mattress retailer with stores across Canada. Each description goes on the product page of their Magento store, is reviewed by a person, and must help the page rank in Google.ca and help a shopper decide.

Voice: warm, plain and practical. Short sentences. Canadian spelling (colour, centre). Speak to the shopper ("you"). No hype, no exclamation marks.

Facts: use only the product data you are given, plus what you confirm in research about this exact product (same brand and model). Every number you write (dimensions, piece counts, sizes, weights) must appear in the product data or its current description; if a spec isn't there, describe the product without it. Never mention price, sales, financing, delivery times, stock, warranties, certifications, country of manufacture, materials or features that the data or research does not state. Never name other retailers. No superlatives such as "best".

Structure for description_html (bare <p>, <ul>, <li>, <strong> only):
1. One opening paragraph (2–3 sentences) that uses the primary keyword naturally in its first sentence and says what the product is and who or which room it suits.
2. A <ul> of 3–5 short feature bullets drawn from the facts.
3. One closing sentence on how it fits a room or pairs with other pieces.
Total 90–150 words. Use secondary keywords only where they read naturally; never stuff keywords or repeat the primary more than twice.

meta_title: at most 60 characters, starting with the product's descriptive name and primary keyword, ending with " | Surplus Furniture" when it fits.
meta_description: 120–155 characters, includes the primary keyword, plain and specific.
keywords_used: the target keywords you actually used.
research_sources: URLs you relied on, empty if none.
reviewer_notes: one or two sentences for the reviewer: anything you could not confirm, conflicting data, or facts the description would benefit from (for example missing dimensions).
faq: three or four questions shoppers ask about this kind of product (use the shopper questions provided when they fit), each answered in one or two plain sentences from the product data only. Skip any question the data cannot answer.
faq_gaps: up to three common shopper questions the product data cannot answer (for example weight capacity, care instructions, assembly, dimensions), each with a short reason to add that detail.`;

export const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["description_html", "meta_title", "meta_description", "keywords_used", "research_sources", "reviewer_notes", "faq", "faq_gaps"],
  properties: {
    description_html: { type: "string" },
    meta_title: { type: "string" },
    meta_description: { type: "string" },
    keywords_used: { type: "array", items: { type: "string" } },
    research_sources: { type: "array", items: { type: "string" } },
    reviewer_notes: { type: "string" },
    faq: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["q", "a"],
        properties: { q: { type: "string" }, a: { type: "string" } },
      },
    },
    faq_gaps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["q", "why"],
        properties: { q: { type: "string" }, why: { type: "string" } },
      },
    },
  },
} as const;

export function draftRequestText(
  product: ProductInput,
  plan: KeywordPlan,
  opts: { research: boolean; shopperQuestions?: string[] },
): string {
  return JSON.stringify(
    {
      product: productFacts(product),
      current_description: stripHtml(product.currentDescription ?? "") || null,
      keywords: {
        primary: plan.primary?.keyword ?? null,
        secondary: plan.secondary.map((e) => e.keyword),
        note: plan.primary
          ? "Monthly Google.ca searches are behind these choices; the primary matters most."
          : "No keyword data for this product type: describe it with the plain words shoppers would search for.",
      },
      shopper_questions: opts.shopperQuestions?.length ? opts.shopperQuestions : undefined,
      research: opts.research
        ? "Search the web for this exact product (brand and model or name) to learn its style and features. Ignore pages for other models. Numbers must still come from the product data."
        : "No research: use only the product data.",
    },
    null,
    2,
  );
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** FAQ items as description HTML: a bold question paragraph followed by its answer. */
export function faqToHtml(items: FaqItem[]): string {
  return items.map(({ q, a }) => `<p><strong>${escapeHtml(q)}</strong></p><p>${escapeHtml(a)}</p>`).join("");
}

/** FAQ answers follow the description's fact rules; length and keyword checks don't apply. */
export function validateFaq(faqHtml: string, product: ProductInput, plan: KeywordPlan): DraftIssue[] {
  if (!faqHtml) return [];
  const probe: ProductDraft = {
    description_html: faqHtml,
    meta_title: "",
    meta_description: "",
    keywords_used: [],
    research_sources: [],
    reviewer_notes: "",
  };
  return validateDraft(probe, product, { ...plan, primary: null }).filter((i) =>
    ["unsupported_number", "unsupported_claim", "banned", "html"].includes(i.code),
  );
}

/**
 * Server-side cleanup of edited copy: keeps p, ul, li and strong (b becomes strong, div
 * becomes p), drops every attribute and any other tag, and removes script and style bodies.
 */
export function sanitizeCopyHtml(html: string): string {
  const withoutBlocks = html.replace(/<(script|style|iframe|object|template)[\s\S]*?<\/\1\s*>/gi, "");
  const cleaned = withoutBlocks.replace(/<(\/?)([a-z][a-z0-9]*)\b[^>]*>/gi, (_m, slash: string, rawTag: string) => {
    const tag = rawTag.toLowerCase();
    const mapped = tag === "b" ? "strong" : tag === "div" ? "p" : tag;
    if (tag === "br") return " ";
    return ALLOWED_TAGS.has(mapped) ? `<${slash}${mapped}>` : "";
  });
  // Any '<' left over is not one of our tags: escape it so it can't open markup.
  return cleaned
    .replace(/<(?!\/?(p|ul|li|strong)>)/g, "&lt;")
    .replace(/<p>\s*<\/p>/g, "")
    .trim();
}
