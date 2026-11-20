// Product data the store's developer can add in Magento so the copy can say more.
// Each ask names one detail, why it matters (a keyword it unlocks, a shopper question,
// a competitor showing it) and whether the developer types the value in. A value the
// developer confirms becomes a product fact, and the description is rewritten with it.
// Pure: no network, storage or Next imports.
import { normalizeProductText } from "./keywords";
import type { FaqGap, ProductInput } from "./rules";

export interface DataAsk {
  /** Unique within a product: lowercase letters, digits and hyphens. */
  id: string;
  /** The detail, as the developer sees it: "Drawer count". */
  field: string;
  /** What to do in Magento. */
  ask: string;
  /** Why it's worth the time. */
  why: string;
  /** The keyword this detail lets the copy target, with its monthly Google.ca searches. */
  keyword?: { keyword: string; volume: number };
  /** True when the developer types the value, which then goes into the description. */
  needsValue: boolean;
  placeholder?: string;
}

export interface FixState {
  batchId: string;
  sku: string;
  askId: string;
  status: "done" | "not_applicable";
  value: string;
  by: string;
  at: string;
}

interface Curated {
  categories: string[] | "all";
  id: string;
  field: string;
  ask: string;
  why: string;
  keyword?: { keyword: string; volume: number };
  placeholder: string;
  /** Already in the product data: no ask. Tested against normalized name, attributes and copy. */
  present: RegExp;
  /** Shopper questions (FAQ gaps) this ask already covers. */
  covers: RegExp;
}

// Keyword volumes match keywords.ts (Semrush, Google.ca, Oct–Nov 2026).
const CURATED: Curated[] = [
  {
    categories: ["nightstand"],
    id: "drawer-count",
    field: "Drawer count",
    ask: "Add the number of drawers.",
    why: "If it has drawers, the page can target “nightstand with drawers”.",
    keyword: { keyword: "nightstand with drawers", volume: 1000 },
    placeholder: "e.g. 2 drawers",
    present: /\b(\d+|one|two|three|four|five|six|seven|eight|nine) drawers?\b|\bno drawers?\b/,
    covers: /\bdrawer/i,
  },
  {
    categories: ["dresser"],
    id: "drawer-count",
    field: "Drawer count",
    ask: "Add the number of drawers.",
    why: "Shoppers search by drawer count. With 6 drawers the page can target “6 drawer dresser”.",
    keyword: { keyword: "6 drawer dresser", volume: 2400 },
    placeholder: "e.g. 6 drawers",
    present: /\b(\d+|one|two|three|four|five|six|seven|eight|nine) drawers?\b/,
    covers: /\bdrawer/i,
  },
  {
    categories: ["loft-bed"],
    id: "mattress-size",
    field: "Mattress size",
    ask: "Add the mattress size it takes.",
    why: "Shoppers ask which mattress fits. With a twin size the page can target “twin loft bed”.",
    keyword: { keyword: "twin loft bed", volume: 720 },
    placeholder: "e.g. Twin",
    present: /\b(twin|single|full|double|queen|king)\b/,
    covers: /\bmattress|\bsheets?\b|\bsize\b/i,
  },
  {
    categories: ["bunk-bed", "loft-bed", "bed-frame", "recliner", "sofa", "sectional"],
    id: "weight-capacity",
    field: "Weight capacity",
    ask: "Add the weight capacity.",
    why: "A common shopper question, and competitors list it.",
    placeholder: "e.g. 250 lb per bunk",
    present: /\b(weight capacity|weight limit|max(imum)? weight|capacity)\b/,
    covers: /\bweight\b|\bcapacity\b/i,
  },
  {
    categories: ["bunk-bed", "loft-bed", "dresser", "nightstand", "dining-set", "sofa", "sectional"],
    id: "dimensions",
    field: "Dimensions",
    ask: "Add the width, depth and height.",
    why: "Shoppers check that it fits their room before they buy.",
    placeholder: "e.g. 42 W x 78 D x 65 H in",
    // Text is normalized (quotes dropped), so 54"W x 16"D reads "54 w x 16 d".
    present: /\b(dimensions?|width|height|depth)\b|\b\d+(\.\d+)?\s?(in|inch|inches|cm|w|d|h)\b|\d+(\.\d+)?\s?x\s?\d+/,
    covers: /\bdimension|\bhow (big|wide|tall)|\bsize of\b/i,
  },
  {
    categories: ["recliner"],
    id: "reclining-type",
    field: "Reclining type",
    ask: "Say whether it reclines manually or with power.",
    why: "Shoppers ask before they buy.",
    placeholder: "e.g. Manual (pull lever)",
    present: /\b(manual|power|electric|push ?back|lever)\b/,
    covers: /\bmanual\b|\bpower\b/i,
  },
  {
    categories: ["recliner", "sofa", "sectional"],
    id: "care",
    field: "Care instructions",
    ask: "Add how to clean the fabric.",
    why: "Shoppers ask how to clean it, and it can go into the product FAQ.",
    placeholder: "e.g. Spot clean with a damp cloth",
    present: /\b(spot clean|clean(ing)? code|care instructions?|wipe clean|machine wash)\b/,
    covers: /\bclean|\bcare\b/i,
  },
];

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "detail";

/** Everything the product already states, for the `present` checks. */
function productText(product: ProductInput): string {
  return normalizeProductText(
    [
      product.name,
      ...(product.categories ?? []),
      ...Object.entries(product.attributes ?? {}).map(([k, v]) => `${k} ${v ?? ""}`),
      product.currentDescription ?? "",
    ].join(" "),
  );
}

/**
 * The asks for one product: curated details its category needs and its data lacks, then
 * the shopper questions (FAQ gaps) no curated ask already covers.
 */
export function dataAsks(product: ProductInput, categoryId: string | null | undefined, faqGaps: FaqGap[] = []): DataAsk[] {
  const text = productText(product);
  const asks: DataAsk[] = [];
  const curated = CURATED.filter(
    (c) => (c.categories === "all" || (categoryId && c.categories.includes(categoryId))) && !c.present.test(text),
  );
  for (const c of curated) {
    asks.push({
      id: c.id,
      field: c.field,
      ask: c.ask,
      why: c.why,
      ...(c.keyword ? { keyword: c.keyword } : {}),
      needsValue: true,
      placeholder: c.placeholder,
    });
  }
  for (const gap of faqGaps) {
    if (curated.some((c) => c.covers.test(gap.q)) || CURATED.some((c) => c.covers.test(gap.q) && c.present.test(text))) continue;
    const id = `faq-${slug(gap.q)}`;
    if (asks.some((a) => a.id === id)) continue;
    asks.push({
      id,
      field: gap.q,
      ask: "Add the answer to the product details.",
      why: gap.why,
      needsValue: true,
      placeholder: "The answer, as you'd tell a shopper",
    });
  }
  return asks;
}

/** Values the developer confirmed, as product attributes keyed by the detail's name. */
export function confirmedFacts(asks: DataAsk[], fixes: FixState[]): Record<string, string> {
  const facts: Record<string, string> = {};
  for (const fix of fixes) {
    if (fix.status !== "done" || !fix.value.trim()) continue;
    const ask = asks.find((a) => a.id === fix.askId);
    if (ask?.needsValue) facts[ask.field] = fix.value.trim();
  }
  return facts;
}

export const isAskId = (id: string) => /^[a-z0-9-]{1,48}$/.test(id);
