// Reads Surplus Furniture's Google Merchant Center products through the Windsor.ai
// Connectors API (the same endpoint Briefcase uses: /all with select_accounts).
// Merchant Center is a stand-in for Magento until the store's API is connected: it
// carries the title, description, brand, colour, product type, link and creation date.
import { httpUrl } from "../urls";
import type { ProductInput } from "../copy/rules";

const WINDSOR_URL = "https://connectors.windsor.ai/all";

export const MERCHANT_FIELDS = [
  "datasource",
  "account_id",
  "product_id",
  "product_title",
  "product_description",
  "product_brand",
  "product_color",
  "product_material",
  "product_size",
  "product_type_l1",
  "product_type_l2",
  "product_link",
  "product_image_link",
  "product_creation_date",
  "product_channel",
] as const;

export type MerchantRow = Partial<Record<(typeof MERCHANT_FIELDS)[number], string | null>>;

export class FeedError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

/** Product page URL without the feed's store and UTM parameters. */
export function cleanProductUrl(link: string | null | undefined): string | undefined {
  if (!link) return undefined;
  try {
    const url = new URL(link);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

export function productFromMerchantRow(row: MerchantRow): ProductInput | null {
  const sku = row.product_id?.trim();
  const name = row.product_title?.trim();
  if (!sku || !name) return null;
  const attributes: Record<string, string> = {};
  if (row.product_color) attributes.colour = row.product_color;
  if (row.product_material) attributes.material = row.product_material;
  if (row.product_size) attributes.size = row.product_size;
  return {
    sku,
    name,
    url: cleanProductUrl(row.product_link),
    brand: row.product_brand ?? undefined,
    categories: [row.product_type_l1, row.product_type_l2].filter((c): c is string => Boolean(c && c.trim())),
    attributes,
    currentDescription: row.product_description ?? "",
    createdAt: row.product_creation_date ?? undefined,
  };
}

/** One product per SKU (online channel first), from Windsor rows. */
export function productsFromMerchantRows(rows: MerchantRow[]): ProductInput[] {
  const bySku = new Map<string, { product: ProductInput; online: boolean }>();
  for (const row of rows) {
    const product = productFromMerchantRow(row);
    if (!product) continue;
    const online = (row.product_channel ?? "").toUpperCase() === "ONLINE";
    const existing = bySku.get(product.sku);
    if (!existing || (online && !existing.online)) bySku.set(product.sku, { product, online });
  }
  return [...bySku.values()].map((v) => v.product);
}

export interface FeedOptions {
  apiKey: string;
  accountId: string;
  /** Product rows are dated by creation, so the window starts well before the catalogue. */
  dateFrom?: string;
  dateTo?: string;
  fetchImpl?: typeof fetch;
}

export async function fetchMerchantProducts(opts: FeedOptions): Promise<{ products: ProductInput[]; images: Record<string, string> }> {
  const params = new URLSearchParams({
    api_key: opts.apiKey,
    fields: MERCHANT_FIELDS.join(","),
    date_from: opts.dateFrom ?? "2015-01-01",
    date_to: opts.dateTo ?? new Date().toISOString().slice(0, 10),
    select_accounts: `google_merchant__${opts.accountId}`,
  });
  let response: Response;
  try {
    response = await (opts.fetchImpl ?? fetch)(`${WINDSOR_URL}?${params}`, {
      headers: { "User-Agent": "SurplusProductDescriptions/1.0" },
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new FeedError("Windsor.ai request failed or timed out.", true);
  }
  if (response.status === 401 || response.status === 403)
    throw new FeedError("Windsor.ai authentication failed. Check WINDSOR_API_KEY and account access.", false);
  if (!response.ok) throw new FeedError(`Windsor.ai returned HTTP ${response.status}.`, response.status === 429 || response.status >= 500);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new FeedError("Windsor.ai returned invalid JSON.", true);
  }
  const rows = (payload as { data?: unknown })?.data;
  if (!Array.isArray(rows)) throw new FeedError("Windsor.ai response did not contain a data list.", false);
  // Windsor can return other datasources on /all; keep only this Merchant Center account.
  const own = (rows as MerchantRow[]).filter(
    (r) => (!r.datasource || r.datasource === "google_merchant") && (!r.account_id || String(r.account_id) === opts.accountId),
  );
  const images: Record<string, string> = {};
  for (const r of own) {
    const image = r.product_id ? httpUrl(r.product_image_link) : undefined;
    if (r.product_id && image) images[r.product_id] = image;
  }
  return { products: productsFromMerchantRows(own), images };
}
