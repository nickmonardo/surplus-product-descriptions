import { copyReasons, type ProductInput } from "./copy/rules";

/**
 * Which products need copy this week: new since the last batch (newest first), then
 * missing or thin descriptions (newest first), skipping anything drafted before.
 */
export function selectCandidates(products: ProductInput[], drafted: Set<string>, since: string, limit: number) {
  const scored = products
    .filter((p) => !drafted.has(p.sku))
    .map((p) => ({ product: p, reasons: copyReasons(p, since) }))
    .filter((c) => c.reasons.length);
  const isNew = (c: (typeof scored)[number]) => c.reasons.includes("new");
  const byDate = (a: (typeof scored)[number], b: (typeof scored)[number]) =>
    (b.product.createdAt ?? "").localeCompare(a.product.createdAt ?? "");
  return [...scored.filter(isNew).sort(byDate), ...scored.filter((c) => !isNew(c)).sort(byDate)].slice(0, limit);
}

/**
 * Review order: the weakest current descriptions first (fewest words, so missing ones lead),
 * where the new copy makes the biggest difference. Ties keep their batch order.
 */
export function reviewOrder<T extends { currentText: string }>(products: T[]): T[] {
  const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
  return products
    .map((p, i) => ({ p, i, w: words(p.currentText ?? "") }))
    .sort((a, b) => a.w - b.w || a.i - b.i)
    .map(({ p }) => p);
}
