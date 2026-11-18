// Reads a Magento 2 catalog product export (System → Data Transfer → Export,
// entity "Products", CSV) into ProductInput rows. Until the API integration
// exists, this is how new or thin SKUs reach the drafting step.
import type { ProductInput } from "./rules";

/** RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim()));
}

export function csvRecords(text: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return rows.map((cells) => Object.fromEntries(keys.map((key, i) => [key, (cells[i] ?? "").trim()])));
}

/**
 * Magento's `additional_attributes` column: `code=value` pairs joined by
 * commas, multi-select values joined by `|`. A comma inside a value cannot be
 * told apart from a separator, so a segment without `=` joins the previous value.
 */
export function parseAdditionalAttributes(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  let last: string | null = null;
  for (const segment of raw.split(",")) {
    const eq = segment.indexOf("=");
    if (eq > 0 && /^[a-z0-9_]+$/i.test(segment.slice(0, eq).trim())) {
      last = segment.slice(0, eq).trim();
      out[last] = segment.slice(eq + 1).replace(/\|/g, ", ").trim();
    } else if (last) {
      out[last] = `${out[last]},${segment}`.trim();
    }
  }
  return out;
}

// Columns that describe the product to a shopper. Everything else in the
// export (tax class, websites, images, stock) is housekeeping.
const DESCRIPTIVE_COLUMNS = ["color", "colour", "material", "size", "weight", "manufacturer", "country_of_manufacture"];
const SKIP_ATTRIBUTES = /^(gift|msrp|tax|news_|custom_|page_layout|options_container|quantity_and_stock|required_options|has_options|image|small_image|thumbnail|swatch|url_|meta_|special_|cost|ts_|allow_|visibility|status|price)/i;

export function productFromExportRow(row: Record<string, string>, baseUrl = "https://www.surplusfurniture.com"): ProductInput {
  const additional = parseAdditionalAttributes(row.additional_attributes ?? "");
  const attributes: Record<string, string> = {};
  for (const column of DESCRIPTIVE_COLUMNS) if (row[column]) attributes[column] = row[column];
  for (const [code, value] of Object.entries(additional)) {
    if (!value || SKIP_ATTRIBUTES.test(code)) continue;
    attributes[code] = value;
  }
  if (attributes.weight && !/[a-z]/i.test(attributes.weight)) delete attributes.weight; // unitless shipping weight
  const categories = (row.categories ?? "")
    .split(",")
    .map((path) => path.split("/").slice(-1)[0]?.trim())
    .filter((c): c is string => Boolean(c) && !/^default category$/i.test(c));
  const brand = additional.brand || additional.manufacturer || row.manufacturer || undefined;
  return {
    sku: row.sku,
    name: row.name,
    url: row.url_key ? `${baseUrl.replace(/\/$/, "")}/${row.url_key}` : undefined,
    brand,
    categories: [...new Set(categories)],
    attributes,
    currentDescription: row.description || row.short_description || "",
    createdAt: row.created_at || undefined,
  };
}

/**
 * Products from an export: default store-view rows only (store_view_code
 * empty), enabled and visible ones only, simple children of configurables skipped
 * when they are "Not Visible Individually".
 */
export function productsFromExport(text: string, baseUrl?: string): ProductInput[] {
  return csvRecords(text)
    .filter((row) => row.sku && row.name && !row.store_view_code)
    .filter((row) => row.product_online !== "2" && !/^not visible/i.test(row.visibility ?? ""))
    .map((row) => productFromExportRow(row, baseUrl));
}
