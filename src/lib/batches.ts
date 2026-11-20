import "server-only";
import seed from "../../data/seed-batch.json";
import { listKeys, readJson, removeKey, writeJson } from "./storage";
import { isAskId } from "./copy/data-asks";
import type { ProductInput } from "./copy/rules";
import type { Batch, BatchProduct, BatchSummary, Decision, FixState, Revision } from "./types";

// The first batch (the November 2026 prototype's ten products) ships with the code, so the
// dashboard has something to review before the first weekly run writes a stored batch.
const SEED = seed as Batch;
const ID_RE = /^[a-z0-9-]{1,64}$/;
const SKU_RE = /^[A-Za-z0-9._-]{1,64}$/;

export const isBatchId = (id: string) => ID_RE.test(id);
export const isSku = (sku: string) => SKU_RE.test(sku);

/** The batch as drafted, without later rewrites. */
async function readBatch(id: string): Promise<Batch | null> {
  if (!isBatchId(id)) return null;
  if (id === SEED.id) return (await readJson<Batch>(`batches/${id}.json`)) ?? SEED;
  return readJson<Batch>(`batches/${id}.json`);
}

/** The batch with each product's latest successful rewrite (if any) in place of its draft. */
export async function getBatch(id: string): Promise<Batch | null> {
  const batch = await readBatch(id);
  if (!batch) return null;
  const revisions = await getRevisions(id);
  if (!Object.keys(revisions).length) return batch;
  return { ...batch, products: batch.products.map((p) => withRevision(p, revisions[p.sku])) };
}

function withRevision(product: BatchProduct, revision: Revision | undefined): BatchProduct {
  if (!revision) return product;
  const info = {
    state: revision.state,
    startedAt: revision.startedAt,
    ...(revision.finishedAt ? { finishedAt: revision.finishedAt } : {}),
    ...(revision.error ? { error: revision.error } : {}),
    facts: revision.result?.facts ?? {},
    ...(revision.result ? { at: revision.result.at } : {}),
  };
  if (!revision.result) return { ...product, revision: info };
  const r = revision.result;
  return {
    ...product,
    draft: r.draft,
    primary: r.primary,
    secondary: r.secondary,
    note: r.note,
    faqGaps: r.faqGaps,
    checksPassed: r.checksPassed,
    issues: r.issues,
    revision: info,
  };
}

/** The feed data behind a product. Older batches didn't store it: rebuild what they showed. */
export function inputFor(product: BatchProduct): ProductInput {
  return (
    product.input ?? {
      sku: product.sku,
      name: product.name,
      ...(product.brand ? { brand: product.brand } : {}),
      ...(product.url ? { url: product.url } : {}),
      ...(product.category ? { categories: [product.category] } : {}),
      currentDescription: product.currentText,
    }
  );
}

// Developer check-offs on the Magento to-do list, one file per product detail.
const fixKey = (batchId: string, sku: string, askId: string) => `fixes/${batchId}/${sku}/${askId}.json`;

export async function getFixes(batchId: string, sku?: string): Promise<FixState[]> {
  if (!isBatchId(batchId) || (sku && !isSku(sku))) return [];
  const keys = await listKeys(sku ? `fixes/${batchId}/${sku}/` : `fixes/${batchId}/`);
  const fixes = await Promise.all(keys.map((k) => readJson<FixState>(k)));
  return fixes.filter((f): f is FixState => Boolean(f));
}

export async function saveFix(fix: FixState): Promise<void> {
  if (!isBatchId(fix.batchId) || !isSku(fix.sku) || !isAskId(fix.askId)) throw new Error("Invalid fix key");
  await writeJson(fixKey(fix.batchId, fix.sku, fix.askId), fix);
}

export async function clearFix(batchId: string, sku: string, askId: string): Promise<void> {
  if (!isBatchId(batchId) || !isSku(sku) || !isAskId(askId)) throw new Error("Invalid fix key");
  await removeKey(fixKey(batchId, sku, askId));
}

// The latest rewrite of each product, kept apart from the batch so rewrites never race.
export async function getRevisions(batchId: string): Promise<Record<string, Revision>> {
  if (!isBatchId(batchId)) return {};
  const keys = await listKeys(`revisions/${batchId}/`);
  const revisions = await Promise.all(keys.map((k) => readJson<Revision>(k)));
  return Object.fromEntries(revisions.filter((r): r is Revision => Boolean(r)).map((r) => [r.sku, r]));
}

export async function getRevision(batchId: string, sku: string): Promise<Revision | null> {
  if (!isBatchId(batchId) || !isSku(sku)) return null;
  return readJson<Revision>(`revisions/${batchId}/${sku}.json`);
}

export async function saveRevision(batchId: string, revision: Revision): Promise<void> {
  if (!isBatchId(batchId) || !isSku(revision.sku)) throw new Error("Invalid revision key");
  await writeJson(`revisions/${batchId}/${revision.sku}.json`, revision);
}

export async function saveBatch(batch: Batch): Promise<void> {
  if (!isBatchId(batch.id)) throw new Error(`Invalid batch id ${batch.id}`);
  await writeJson(`batches/${batch.id}.json`, batch);
}

export async function listBatchIds(): Promise<string[]> {
  const stored = (await listKeys("batches/"))
    .map((k) => k.replace(/^batches\//, "").replace(/\.json$/, ""))
    .filter(isBatchId);
  return [...new Set([...stored, SEED.id])].sort().reverse();
}

export async function getDecisions(batchId: string): Promise<Record<string, Decision>> {
  const keys = await listKeys(`decisions/${batchId}/`);
  const entries = await Promise.all(
    keys.map(async (k) => [k.split("/").pop()!.replace(/\.json$/, ""), await readJson<Decision>(k)] as const),
  );
  return Object.fromEntries(entries.filter(([, d]) => d)) as Record<string, Decision>;
}

export async function saveDecision(batchId: string, decision: Decision): Promise<void> {
  await writeJson(`decisions/${batchId}/${decision.sku}.json`, decision);
}

export async function clearDecision(batchId: string, sku: string): Promise<void> {
  await removeKey(`decisions/${batchId}/${sku}.json`);
}

export async function summarize(batch: Batch): Promise<BatchSummary> {
  const decisions = await getDecisions(batch.id);
  const values = Object.values(decisions).filter((d) => batch.products.some((p) => p.sku === d.sku));
  const approved = values.filter((d) => d.status === "approved").length;
  const rejected = values.filter((d) => d.status === "rejected").length;
  const fixes = await getFixes(batch.id);
  const asks = batch.products.reduce((n, p) => n + (p.dataAsks?.length ?? 0), 0);
  const closed = new Set(fixes.map((f) => `${f.sku}/${f.askId}`));
  const open = batch.products.reduce(
    (n, p) => n + (p.dataAsks ?? []).filter((a) => !closed.has(`${p.sku}/${a.id}`)).length,
    0,
  );
  return {
    id: batch.id,
    createdAt: batch.createdAt,
    source: batch.source,
    total: batch.products.length,
    approved,
    rejected,
    pending: batch.products.length - approved - rejected,
    magentoOpen: asks ? open : 0,
  };
}

export async function listBatches(): Promise<Batch[]> {
  const ids = await listBatchIds();
  return (await Promise.all(ids.map(getBatch))).filter((b): b is Batch => Boolean(b));
}

export async function listBatchSummaries(): Promise<BatchSummary[]> {
  return Promise.all((await listBatches()).map(summarize));
}

/** SKUs drafted in earlier batches: a product is drafted once, then waits for review. */
export async function draftedSkus(): Promise<Set<string>> {
  const state = await readJson<{ skus: string[] }>("state/drafted.json");
  return new Set([...(state?.skus ?? []), ...SEED.products.map((p) => p.sku)]);
}

export async function markDrafted(skus: string[]): Promise<void> {
  const current = await draftedSkus();
  for (const s of skus) current.add(s);
  await writeJson("state/drafted.json", { skus: [...current].sort(), updatedAt: new Date().toISOString() });
}
