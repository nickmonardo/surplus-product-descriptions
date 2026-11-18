import "server-only";
import seed from "../../data/seed-batch.json";
import { listKeys, readJson, removeKey, writeJson } from "./storage";
import type { Batch, BatchSummary, Decision } from "./types";

// The first batch (the November 2026 prototype's ten products) ships with the code, so the
// dashboard has something to review before the first weekly run writes a stored batch.
const SEED = seed as Batch;
const ID_RE = /^[a-z0-9-]{1,64}$/;
const SKU_RE = /^[A-Za-z0-9._-]{1,64}$/;

export const isBatchId = (id: string) => ID_RE.test(id);
export const isSku = (sku: string) => SKU_RE.test(sku);

export async function getBatch(id: string): Promise<Batch | null> {
  if (!isBatchId(id)) return null;
  if (id === SEED.id) return (await readJson<Batch>(`batches/${id}.json`)) ?? SEED;
  return readJson<Batch>(`batches/${id}.json`);
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
  return {
    id: batch.id,
    createdAt: batch.createdAt,
    source: batch.source,
    total: batch.products.length,
    approved,
    rejected,
    pending: batch.products.length - approved - rejected,
  };
}

export async function listBatchSummaries(): Promise<BatchSummary[]> {
  const ids = await listBatchIds();
  const batches = (await Promise.all(ids.map(getBatch))).filter((b): b is Batch => Boolean(b));
  return Promise.all(batches.map(summarize));
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
