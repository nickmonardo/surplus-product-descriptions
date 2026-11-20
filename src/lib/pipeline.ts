import "server-only";
import { draftedSkus, listBatchIds, getBatch, markDrafted, saveBatch } from "./batches";
import { findTeppermansEquivalent } from "./competitors/teppermans";
import { dataAsks } from "./copy/data-asks";
import { pickKeywords } from "./copy/keywords";
import { shopperQuestions } from "./copy/questions";
import { sanitizeCopyHtml, stripHtml } from "./copy/rules";
import { selectCandidates } from "./select";
import { draftProduct } from "./draft";
import { fetchMerchantProducts } from "./feed/windsor";
import { batchReadyMail, sendMail } from "./mail";
import { signInLink } from "./auth";
import type { Batch, BatchProduct } from "./types";

export interface RunOptions {
  limit?: number;
  research?: boolean;
  /** Pick candidates and report them; no Claude calls, nothing saved, no email. */
  dryRun?: boolean;
  /** Stop starting new products after this many ms, so the run ends inside the function limit. */
  budgetMs?: number;
  now?: Date;
}

export interface RunResult {
  batchId: string | null;
  candidates: { sku: string; name: string; reasons: string[] }[];
  drafted: number;
  failed: number;
  deferred: number;
  emailed: string[];
}

const DAY = 86_400_000;


async function lastBatchDate(): Promise<string | null> {
  for (const id of await listBatchIds()) {
    const batch = await getBatch(id);
    if (batch) return batch.createdAt;
  }
  return null;
}

async function uniqueBatchId(now: Date): Promise<string> {
  const base = now.toISOString().slice(0, 10);
  const existing = new Set(await listBatchIds());
  if (!existing.has(base)) return base;
  for (let i = 2; ; i++) if (!existing.has(`${base}-${i}`)) return `${base}-${i}`;
}

const listEnv = (name: string) =>
  (process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export async function runWeekly(opts: RunOptions = {}): Promise<RunResult> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) throw new Error("WINDSOR_API_KEY is not set.");
  const accountId = process.env.MERCHANT_ACCOUNT_ID ?? "743756928";
  const limit = opts.limit ?? Number(process.env.MAX_PRODUCTS_PER_RUN ?? 12);
  const budget = opts.budgetMs ?? 220_000;

  const { products, images } = await fetchMerchantProducts({ apiKey, accountId });
  const since = (await lastBatchDate()) ?? new Date(now.getTime() - 30 * DAY).toISOString();
  const candidates = selectCandidates(products, await draftedSkus(), since, limit);
  const result: RunResult = {
    batchId: null,
    candidates: candidates.map((c) => ({ sku: c.product.sku, name: c.product.name, reasons: c.reasons })),
    drafted: 0,
    failed: 0,
    deferred: 0,
    emailed: [],
  };
  if (opts.dryRun || !candidates.length) return result;

  const research = opts.research ?? process.env.PIPELINE_RESEARCH === "1";
  const done: BatchProduct[] = [];
  const failures: NonNullable<Batch["failures"]> = [];
  let next = 0;
  const worker = async () => {
    while (next < candidates.length) {
      if (Date.now() - started > budget) return;
      const { product, reasons } = candidates[next++];
      const plan = pickKeywords(product);
      try {
        const [draft, rival] = await Promise.all([
          draftProduct(product, plan, { research, shopperQuestions: shopperQuestions(plan.category?.id) }),
          plan.primary ? findTeppermansEquivalent(plan.primary.keyword, plan.category?.id) : Promise.resolve(null),
        ]);
        done.push({
          sku: product.sku,
          name: product.name,
          brand: product.brand,
          url: product.url,
          image: images[product.sku],
          category: plan.category?.label ?? null,
          created: (product.createdAt ?? "").slice(0, 10),
          kind: reasons.includes("missing") || reasons.includes("thin") ? "thin" : "seo",
          reasons,
          currentText: stripHtml(product.currentDescription ?? ""),
          primary: plan.primary ? { keyword: plan.primary.keyword, volume: plan.primary.volume } : null,
          secondary: plan.secondary.map(({ keyword, volume }) => ({ keyword, volume })),
          draft: {
            description_html: sanitizeCopyHtml(draft.draft.description_html),
            meta_title: draft.draft.meta_title,
            meta_description: draft.draft.meta_description,
            faq_html: sanitizeCopyHtml(draft.faqHtml),
          },
          note: draft.draft.reviewer_notes,
          faqGaps: draft.draft.faq_gaps ?? [],
          competitors: rival ? [rival] : [],
          checksPassed: draft.issues.length === 0,
          issues: draft.issues.map((i) => i.message),
          input: product,
          dataAsks: dataAsks(product, plan.category?.id, draft.draft.faq_gaps ?? []),
        });
      } catch (error) {
        failures.push({ sku: product.sku, name: product.name, error: error instanceof Error ? error.message : "Drafting failed" });
      }
    }
  };
  await Promise.all(Array.from({ length: 3 }, worker));
  result.drafted = done.length;
  result.failed = failures.length;
  result.deferred = candidates.length - done.length - failures.length;
  if (!done.length) return result;

  const order = new Map(candidates.map((c, i) => [c.product.sku, i]));
  done.sort((a, b) => order.get(a.sku)! - order.get(b.sku)!);
  const batch: Batch = {
    id: await uniqueBatchId(now),
    createdAt: now.toISOString(),
    source: "Google Merchant Center via Windsor",
    products: done,
    ...(failures.length ? { failures } : {}),
  };
  await saveBatch(batch);
  await markDrafted(done.map((p) => p.sku));
  result.batchId = batch.id;

  const seo = done.filter((p) => p.kind === "seo").length;
  for (const to of listEnv("NOTIFY_EMAILS")) {
    const link = signInLink(to, 3 * 86400, `/batches/${batch.id}`);
    const { sent } = await sendMail(batchReadyMail(to, link, done.length, seo, done.length - seo));
    if (sent) result.emailed.push(to);
  }
  return result;
}
