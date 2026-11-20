import "server-only";
import { randomUUID } from "node:crypto";
import { clearDecision, getBatch, getDecisions, getFixes, getRevision, inputFor, saveRevision } from "./batches";
import { confirmedFacts } from "./copy/data-asks";
import { pickKeywords } from "./copy/keywords";
import { shopperQuestions } from "./copy/questions";
import { revisionRequestText, sanitizeCopyHtml, stripHtml, type ProductInput } from "./copy/rules";
import { draftProduct } from "./draft";
import type { Revision } from "./types";

/**
 * Marks a rewrite of one product as started, with every detail the developer has confirmed
 * for it so far. Returns the request id to pass to `runRewrite`, or null when there is
 * nothing to add.
 */
export async function startRewrite(batchId: string, sku: string): Promise<string | null> {
  const batch = await getBatch(batchId);
  const product = batch?.products.find((p) => p.sku === sku);
  if (!product) return null;
  const facts = confirmedFacts(product.dataAsks ?? [], await getFixes(batchId, sku));
  if (!Object.keys(facts).length) return null;
  const previous = await getRevision(batchId, sku);
  const requestId = randomUUID();
  await saveRevision(batchId, {
    sku,
    state: "running",
    requestId,
    startedAt: new Date().toISOString(),
    facts,
    ...(previous?.result ? { result: previous.result } : {}),
  });
  return requestId;
}

/**
 * Rewrites the copy the client last saw (their approved or edited version, else the
 * suggestion) with the confirmed details, checks it like any draft, and sends the product
 * back to "To review". A newer rewrite started meanwhile wins; this one then stops.
 */
export async function runRewrite(batchId: string, sku: string, requestId: string): Promise<void> {
  const current = await getRevision(batchId, sku);
  if (!current || current.requestId !== requestId) return;
  const finish = async (patch: Partial<Revision>) => {
    const latest = await getRevision(batchId, sku);
    if (!latest || latest.requestId !== requestId) return false;
    await saveRevision(batchId, { ...latest, ...patch, finishedAt: new Date().toISOString() });
    return true;
  };
  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("Rewriting isn't set up (no Anthropic key).");
    const batch = await getBatch(batchId);
    const product = batch?.products.find((p) => p.sku === sku);
    if (!product) throw new Error("Product not found in this batch.");
    const decision = (await getDecisions(batchId))[sku];
    const base = decision?.status === "approved" ? decision : product.draft;

    const input = inputFor(product);
    const withFacts: ProductInput = { ...input, attributes: { ...(input.attributes ?? {}), ...current.facts } };
    const plan = pickKeywords(withFacts);
    // The checks accept facts from the product data, the confirmed details and the copy the
    // client already saw (it was checked, or written by the client).
    const checked: ProductInput = {
      ...withFacts,
      currentDescription: [input.currentDescription ?? "", stripHtml(base.description_html), stripHtml(base.faq_html ?? "")].join("\n"),
    };
    const questions = shopperQuestions(plan.category?.id);
    const result = await draftProduct(checked, plan, {
      research: false,
      shopperQuestions: questions,
      requestText: revisionRequestText(withFacts, plan, base, current.facts, questions),
    });
    const saved = await finish({
      state: "done",
      error: undefined,
      result: {
        draft: {
          description_html: sanitizeCopyHtml(result.draft.description_html),
          meta_title: result.draft.meta_title.trim(),
          meta_description: result.draft.meta_description.trim(),
          faq_html: sanitizeCopyHtml(result.faqHtml),
        },
        primary: plan.primary ? { keyword: plan.primary.keyword, volume: plan.primary.volume } : null,
        secondary: plan.secondary.map(({ keyword, volume }) => ({ keyword, volume })),
        note: result.draft.reviewer_notes,
        faqGaps: result.draft.faq_gaps ?? [],
        checksPassed: result.issues.length === 0,
        issues: result.issues.map((i) => i.message),
        facts: current.facts,
        at: new Date().toISOString(),
      },
    });
    // New copy needs a new look: back to "To review".
    if (saved && decision) await clearDecision(batchId, sku);
  } catch (error) {
    await finish({ state: "failed", error: error instanceof Error ? error.message : "Rewrite failed" });
  }
}
