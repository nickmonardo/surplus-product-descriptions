// Product-page keyword map for Surplus Furniture product descriptions.
// Volumes and difficulty are Semrush, Google.ca database, read 2026-10-28
// (loft beds, bed frames, recliner and dining-with-bench terms and the extra
// dresser, nightstand, bunk-bed, sofa and sectional terms 2026-11-17).
// Product pages are matched to one category by name (then category path);
// a keyword whose `requires` tokens all appear in the product's own text is
// product-specific and preferred over the category's head term.

export const KEYWORD_DATA_SOURCE = "Semrush (Google.ca), Oct–Nov 2026";

export interface KeywordEntry {
  keyword: string;
  volume: number;
  difficulty: number;
  /** Every pattern must match the product text for this keyword to apply. */
  requires?: RegExp[];
  /** No pattern may match: "loveseat" alone is wrong for a sofa and loveseat set. */
  excludes?: RegExp[];
}

export interface CategoryKeywords {
  id: string;
  label: string;
  /** Matched against the normalized product name first, then its categories. */
  match: RegExp;
  exclude?: RegExp;
  keywords: KeywordEntry[];
}

const k = (keyword: string, volume: number, difficulty: number, ...requires: RegExp[]): KeywordEntry => ({
  keyword,
  volume,
  difficulty,
  ...(requires.length ? { requires } : {}),
});
const without = (entry: KeywordEntry, ...excludes: RegExp[]): KeywordEntry => ({ ...entry, excludes });

// Colour words only; finish names such as "Granite" are not assumed to be grey.
const GREY = /\b(grey|gray|charcoal)\b/;

// Order matters: the first matching category wins (loft bed before bunk bed,
// sectional before sofa, bunk bed before bedroom set, beds before bed frames).
export const CATEGORY_KEYWORDS: CategoryKeywords[] = [
  {
    id: "loft-bed",
    label: "Loft beds",
    match: /\bloft ?beds?\b/,
    keywords: [
      k("loft bed", 8100, 19),
      k("kids loft bed", 1300, 27),
      k("loft bed with desk", 2400, 15, /\bdesk\b/),
      k("twin loft bed", 720, 15, /\btwin\b/),
      k("loft bed with desk and storage", 110, 14, /\bdesk\b/, /\b(book ?case|shel(f|ves)|storage|drawers?)\b/),
    ],
  },
  {
    id: "bunk-bed",
    label: "Bunk beds",
    match: /\bbunk ?beds?\b/,
    keywords: [
      k("bunk beds", 8100, 25),
      k("bunk bed", 6600, 21),
      k("bunk beds for kids", 1900, 25),
      k("kids bunk beds", 1000, 14),
      k("bunk beds canada", 1600, 32),
      k("twin over full bunk bed", 720, 26, /\btwin\b/, /\bfull\b/),
      k("twin over twin bunk bed", 590, 25, /\btwin (over )?twin\b/),
      k("bunk beds with stairs", 720, 9, /\bstair/),
      k("bunk bed with trundle", 320, 14, /\btrundle\b/),
      k("grey bunk bed", 50, 0, GREY),
    ],
  },
  {
    id: "sectional",
    label: "Sectionals",
    match: /\bsectionals?\b/,
    keywords: [
      k("sectional couch", 8100, 27),
      k("sectional sofa", 6600, 24),
      k("sectional", 4400, 29),
      k("sectionals canada", 590, 25),
      k("sectional with chaise", 590, 23, /\bchaise\b/),
      k("sectional sofa with chaise", 320, 26, /\bchaise\b/),
      k("brown sectional", 320, 12, /\bbrown\b/),
      k("grey sectional", 480, 14, GREY),
      k("grey sectional sofa", 390, 13, GREY),
      k("sectional with ottoman", 140, 13, /\bottoman\b/),
      k("2 piece sectional", 140, 21, /\b2 ?(pc|pcs|piece)\b/),
      k("reversible sectional", 70, 14, /\breversible\b/),
    ],
  },
  {
    id: "mattress",
    label: "Mattresses",
    match: /\bmattress(es)?\b/,
    exclude: /\b(protector|topper|pad|cover)\b/,
    keywords: [
      k("mattress", 33100, 32),
      k("queen mattress", 12100, 17, /\bqueen\b/),
      k("firm mattress", 1900, 21, /\bfirm\b/),
      k("hybrid mattress", 1900, 23, /\bhybrid\b/),
      k("extra firm mattress", 880, 22, /\bextra firm\b/),
      k("pocket coil mattress", 720, 9, /\bpocket(ed)? coils?\b/),
      k("firm queen mattress", 480, 19, /\bfirm\b/, /\bqueen\b/),
      k("queen mattress canada", 320, 21, /\bqueen\b/),
      k("extra firm queen mattress", 110, 29, /\bextra firm\b/, /\bqueen\b/),
    ],
  },
  {
    id: "dining-set",
    label: "Dining sets",
    match: /\bdining\b|\bdinette\b|\bkitchen table\b|\bcounter height\b|\bpub (height|table|set)\b/,
    keywords: [
      k("dining table set", 9900, 33),
      k("dining set", 2400, 28),
      k("dining room set", 880, 23),
      k("kitchen table set", 590, 32),
      k("5 piece dining set", 480, 17, /\b(5 ?(pc|pcs|piece))\b/),
      k("7 piece dining set", 480, 13, /\b(7 ?(pc|pcs|piece))\b/),
      k("6 piece dining set", 90, 12, /\b(6 ?(pc|pcs|piece))\b/),
      k("dining table with bench", 1000, 37, /\bbench\b/),
      k("dining set with bench", 390, 26, /\bbench\b/),
      k("dinette sets", 390, 31, /\bdinette\b/),
      k("counter height dining set", 390, 19, /\b(counter|pub) height\b/),
    ],
  },
  {
    id: "recliner",
    label: "Recliners",
    match: /\brecliners?\b|\brocker recliner\b/,
    exclude: /\b(sofa|loveseat|sectional)\b/,
    keywords: [
      k("recliner", 4400, 24),
      k("recliners", 2900, 18),
      k("power recliner", 880, 18, /\bpower\b/),
      k("rocker recliner", 720, 27, /\brocker\b/),
      k("swivel recliner", 590, 17, /\bswivel\b/),
      k("glider recliner", 590, 21, /\bglid(er|ing|es)\b/),
      k("swivel rocker recliner", 590, 14, /\bswivel\b/, /\brocker\b/),
      k("swivel recliner chair", 480, 16, /\bswivel\b/),
      k("swivel glider recliner", 260, 13, /\bswivel\b/, /\bglid(er|ing|es)\b/),
    ],
  },
  {
    id: "sofa",
    label: "Sofas",
    match: /\bsofas?\b|\bcouch(es)?\b|\bloveseats?\b/,
    keywords: [
      k("sofa", 33100, 32),
      k("couch", 33100, 49),
      k("sofas", 5400, 28),
      without(k("loveseat", 5400, 21, /\bloveseat\b/), /\bsofa\b/, /\bset\b/),
      k("sofa canada", 1600, 49),
      k("sofa and ottoman", 590, 11, /\bottoman\b/),
      k("couch and ottoman", 590, 14, /\bottoman\b/),
      k("sofa and loveseat set", 590, 25, /\bsofa\b/, /\bloveseat\b/),
      k("couch and loveseat set", 590, 26, /\b(sofa|couch)\b/, /\bloveseat\b/),
      k("grey couch", 590, 15, GREY),
      k("fabric sofa", 480, 14, /\b(fabric|polyester|linen|chenille|microfib(er|re))\b/),
      k("grey sofa", 390, 19, GREY),
    ],
  },
  {
    id: "bedroom-set",
    label: "Bedroom sets",
    match: /\bbedroom sets?\b|\b\d ?(pc|pcs|piece) (queen|king|full|twin) bedroom\b/,
    keywords: [
      k("bedroom sets", 3600, 24),
      k("bedroom set", 2900, 22),
      k("queen bedroom set", 590, 24, /\bqueen\b/),
      k("king bedroom set", 590, 14, /\bking\b/),
    ],
  },
  {
    id: "dresser",
    label: "Dressers",
    match: /\bdressers?\b|\bchest of drawers\b/,
    keywords: [
      k("dresser", 27100, 29),
      k("bedroom dresser", 2400, 31),
      k("dresser canada", 480, 23),
      k("6 drawer dresser", 2400, 20, /\b6 drawers?\b/),
      k("wood dresser", 1300, 36, /\b(solid )?wood\b/),
      k("oak dresser", 590, 23, /\boak\b/),
      k("dark wood dresser", 260, 19, /\bdark (oak|wood|walnut|espresso)\b/),
    ],
  },
  {
    id: "nightstand",
    label: "Nightstands",
    match: /\bnight ?stands?\b|\bbedside table\b/,
    keywords: [
      k("nightstand", 12100, 28),
      k("bedside table", 6600, 23),
      k("night stand", 4400, 32),
      k("nightstand with drawers", 1000, 32, /\bdrawers\b/),
      k("wood nightstand", 720, 20, /\b(solid )?wood\b/),
      k("oak nightstand", 320, 20, /\boak\b/),
      k("dark wood nightstand", 110, 16, /\bdark (oak|wood|walnut|espresso)\b/),
    ],
  },
  {
    id: "bed-frame",
    label: "Bed frames",
    match: /\bbed frames?\b|\b(glide )?support frame\b|\bstorable base\b/,
    exclude: /\b(bunk|loft)\b/,
    keywords: [
      k("bed frame", 22200, 35),
      k("bed frame canada", 720, 26),
      k("queen bed frame", 18100, 33, /\bqueen\b/),
      k("twin bed frame", 9900, 23, /\btwin\b/),
      k("metal bed frame", 2900, 23, /\bmetal\b/),
      k("full bed frame", 2400, 32, /\bfull\b/),
      k("adjustable bed frame", 1600, 18, /\badjustable\b/),
    ],
  },
];

export function normalizeProductText(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[/_|,()-]+/g, " ")
    .replace(/[^a-z0-9.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findCategory(name: string, categories: string[] = []): CategoryKeywords | null {
  const texts = [normalizeProductText(name), normalizeProductText(categories.join(" "))];
  for (const text of texts) {
    if (!text) continue;
    const found = CATEGORY_KEYWORDS.find((c) => c.match.test(text) && !c.exclude?.test(text));
    if (found) return found;
  }
  return null;
}

export interface KeywordPlan {
  category: { id: string; label: string } | null;
  primary: KeywordEntry | null;
  secondary: KeywordEntry[];
  source: string;
}

const stem = (keyword: string) => keyword.replace(/(es|s)\b/g, "");

/**
 * Picks the primary keyword (the highest-volume product-specific match, else
 * the category's head term) and up to `maxSecondary` supporting keywords
 * (specific matches first, then head terms), skipping plural duplicates.
 */
export function pickKeywords(
  product: { name: string; categories?: string[]; attributes?: Record<string, unknown> },
  maxSecondary = 3,
): KeywordPlan {
  const category = findCategory(product.name, product.categories);
  if (!category) return { category: null, primary: null, secondary: [], source: KEYWORD_DATA_SOURCE };
  const text = normalizeProductText(
    [product.name, ...Object.values(product.attributes ?? {}).map((v) => String(v ?? ""))].join(" "),
  );
  const applies = (entry: KeywordEntry) =>
    (entry.requires ?? []).every((re) => re.test(text)) && !(entry.excludes ?? []).some((re) => re.test(text));
  const byVolume = (a: KeywordEntry, b: KeywordEntry) => b.volume - a.volume;
  const specific = category.keywords.filter((e) => e.requires && applies(e)).sort(byVolume);
  const general = category.keywords.filter((e) => !e.requires && applies(e)).sort(byVolume);
  const ordered = [...specific, ...general];
  const primary = ordered[0] ?? null;
  const seen = new Set(primary ? [stem(primary.keyword)] : []);
  const secondary: KeywordEntry[] = [];
  for (const entry of ordered.slice(1)) {
    if (secondary.length >= maxSecondary) break;
    const key = stem(entry.keyword);
    if (seen.has(key)) continue;
    seen.add(key);
    secondary.push(entry);
  }
  return { category: { id: category.id, label: category.label }, primary, secondary, source: KEYWORD_DATA_SOURCE };
}
