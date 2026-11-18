// Closest Tepperman's equivalent for a product: search by the product's target keyword,
// open the first result and summarize its description (word count, dimensions, keyword
// use, a short verbatim excerpt) and the specs it states that Surplus's listing lacks.
// Plain GET requests only; a site that refuses or changes layout simply yields nothing.

export interface Competitor {
  site: string;
  url?: string;
  name?: string;
  sameBrand?: boolean;
  same?: boolean;
  words?: number;
  dimensions?: boolean;
  keyword?: boolean;
  excerpt?: string;
  note?: string;
  missing?: boolean;
}

const BASE = "https://www.teppermans.com";
const SITE = "Tepperman's";
const UA = "SurplusProductDescriptions/1.0 (+https://theinfluenceagency.com)";

const ENTITIES: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", reg: "®", trade: "™" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

const textOf = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** Search results: product names and their /product- links, in page order. */
export function parseSearchResults(html: string): { name: string; path: string }[] {
  const names = [...html.matchAll(/itemprop="name"[^>]*>([^<]{3,160})</g)].map((m) => decodeEntities(m[1]).trim());
  const paths = [...new Set([...html.matchAll(/href="(\/product-[^"#?]+)"/g)].map((m) => m[1]))];
  return paths.slice(0, names.length).map((path, i) => ({ name: names[i], path }));
}

/** The Description and Specs & Dimensions tabs of a product page. */
export function parseProductPage(html: string): { name: string; description: string; specs: string } | null {
  const h1 = textOf(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "");
  const start = html.indexOf("product-details-information-content-tabs");
  if (start < 0) return null;
  const end = html.indexOf("product-details-related-correlated", start);
  const panels = html.slice(start, end > 0 ? end : undefined).split("information-tab-content-panel").slice(1);
  const clean = (p: string) => textOf("<x " + p).replace(/^Back\s+/, "");
  const description = panels[0] ? clean(panels[0]) : "";
  const specs = panels[1] ? clean(panels[1]) : "";
  return description ? { name: h1, description, specs } : null;
}

const norm = (s: string) =>
  " " + s.toLowerCase().replace(/&/g, "and").replace(/\bgray\b/g, "grey").replace(/[^a-z0-9.]+/g, " ") + " ";

export function hasKeyword(text: string, keyword: string): boolean {
  const n = norm(text);
  const k = norm(keyword).trim();
  return n.includes(` ${k} `) || n.includes(` ${k}s `);
}

/** First real sentence of the description, at most 30 words, kept verbatim. */
export function pickExcerpt(description: string): string {
  const sentences = description
    .replace(/^Includes:[^.]*?(?=[A-Z][a-z]+ )/, "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 8 && !/^includes:/i.test(s));
  const first = sentences[0] ?? "";
  const words = first.split(/\s+/);
  return words.length > 30 ? words.slice(0, 30).join(" ") + "…" : first;
}

/** What the competitor's specs state that a shopper would want: weight capacity, origin, materials. */
export function specsNote(specs: string, description: string): string {
  const found: string[] = [];
  const capacity = specs.match(/Weight Capacity\s+(\d[\d,.]*\s*lbs)/i)?.[1];
  if (capacity) found.push(`a ${capacity.replace(/\s+/g, " ")} weight capacity`);
  if (/made in canada/i.test(specs + " " + description)) found.push("Made in Canada");
  const material = specs.match(/Furniture Material\s+([A-Za-z &]+?)(?=\s+[A-Z][a-z]+ [A-Z]|\s+Furniture Style|$)/)?.[1];
  if (material) found.push(`materials (${material.trim().toLowerCase()})`);
  if (/assembly/i.test(specs + " " + description)) found.push("assembly details");
  return found.length ? `States ${found.join(", ")}.` : "";
}

// What a comparable product's name must say, by keyword-map category.
const CATEGORY_NOUNS: Record<string, RegExp> = {
  "loft-bed": /\bloft ?beds?\b/i,
  "bunk-bed": /\bbunk ?beds?\b/i,
  "bed-frame": /\bbed ?frames?\b|\bbedframes?\b/i,
  dresser: /\bdressers?\b|\bchest of drawers\b/i,
  nightstand: /\bnight ?stands?\b|\bbedside tables?\b/i,
  sectional: /\bsectionals?\b/i,
  sofa: /\bsofas?\b|\bloveseats?\b|\bcouch(es)?\b/i,
  recliner: /\brecliners?\b/i,
  "dining-set": /\bdining (sets?|tables?)\b|\bdinette\b/i,
  mattress: /\bmattress(es)?\b/i,
  "bedroom-set": /\bbedroom sets?\b/i,
};
const NOT_FURNITURE = /\b(comforter|sheet|pillow|protector|rug|lamp|cover|topper|chair)s?\b/i;

/**
 * The first result that is the same kind of product: its name matches the category's noun
 * ("loft bed", not just "bed", so a bunk bed or a comforter set never stands in for a loft
 * bed). Without a category, the keyword's last noun ("dresser" in "oak dresser").
 */
export function pickResult(results: { name: string; path: string }[], keyword: string, categoryId?: string | null) {
  let nounRe = categoryId ? CATEGORY_NOUNS[categoryId] : undefined;
  if (!nounRe) {
    const words = keyword.toLowerCase().split(/\s+/);
    const withAt = words.indexOf("with");
    const phrase = withAt > 0 ? words.slice(0, withAt) : words;
    nounRe = new RegExp(`\\b${phrase[phrase.length - 1].replace(/s$/, "")}s?\\b`, "i");
  }
  const re = nounRe;
  const allowChairs = categoryId === "recliner";
  return results.find((r) => re.test(r.name) && (allowChairs ? !/\b(comforter|sheet|pillow|rug|lamp)s?\b/i.test(r.name) : !NOT_FURNITURE.test(r.name))) ?? null;
}

export interface CompareOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

async function getHtml(url: string, opts: CompareOptions): Promise<string | null> {
  try {
    const res = await (opts.fetchImpl ?? fetch)(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/**
 * The closest Tepperman's product for a target keyword, or a "nothing comparable" row.
 * Returns null when the site can't be reached, so the card simply shows no comparison.
 */
export async function findTeppermansEquivalent(
  keyword: string,
  categoryId: string | null | undefined,
  opts: CompareOptions = {},
): Promise<Competitor | null> {
  const searchHtml = await getHtml(`${BASE}/search?keywords=${encodeURIComponent(keyword)}`, opts);
  if (searchHtml === null) return null;
  const match = pickResult(parseSearchResults(searchHtml), keyword, categoryId);
  if (!match)
    return { site: SITE, missing: true, note: `Tepperman's has nothing matching "${keyword}", so there's nothing comparable to show.` };
  const pageUrl = BASE + match.path;
  const pageHtml = await getHtml(pageUrl, opts);
  const page = pageHtml ? parseProductPage(pageHtml) : null;
  if (!page) return null;
  return {
    site: SITE,
    url: pageUrl,
    name: page.name || match.name,
    same: false,
    sameBrand: false,
    words: page.description.split(/\s+/).filter(Boolean).length,
    dimensions: /\d+(\.\d+)?\s*("|”|in\b)/.test(page.specs + " " + page.description),
    keyword: hasKeyword(page.description, keyword),
    excerpt: pickExcerpt(page.description),
    note: specsNote(page.specs, page.description),
  };
}
