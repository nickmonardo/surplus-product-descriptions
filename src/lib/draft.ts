import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { KeywordPlan } from "./copy/keywords";
import {
  DRAFT_MODEL,
  DRAFT_SCHEMA,
  DRAFT_SYSTEM,
  draftRequestText,
  faqToHtml,
  validateDraft,
  validateFaq,
  type DraftIssue,
  type ProductDraft,
  type ProductInput,
} from "./copy/rules";

type Message = Anthropic.Beta.BetaMessageParam;

export interface DraftResult {
  draft: ProductDraft;
  faqHtml: string;
  issues: DraftIssue[];
  attempts: number;
}

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ maxRetries: 3 }));

async function call(messages: Message[], research: boolean): Promise<{ text: string; messages: Message[] }> {
  let current = messages;
  for (let turn = 0; turn < 4; turn++) {
    const response = await anthropic().beta.messages.create({
      model: DRAFT_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: DRAFT_SYSTEM,
      messages: current,
      ...(research
        ? {
            tools: [
              {
                type: "web_search_20260209",
                name: "web_search",
                max_uses: 3,
                user_location: { type: "approximate", country: "CA" },
              },
            ],
          }
        : {}),
      output_config: { effort: "medium", format: { type: "json_schema", schema: DRAFT_SCHEMA } },
    } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);
    // A long server-tool turn can pause; send it back unchanged to continue.
    if (response.stop_reason === "pause_turn") {
      current = [...current, { role: "assistant", content: response.content }];
      continue;
    }
    if (response.stop_reason === "refusal") throw new Error("Claude declined this product");
    if (response.stop_reason === "max_tokens") throw new Error("Draft was cut off");
    const texts = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text");
    return { text: texts.at(-1)?.text ?? "", messages: [...current, { role: "assistant", content: response.content }] };
  }
  throw new Error("Research did not finish after 4 turns");
}

function check(draft: ProductDraft, product: ProductInput, plan: KeywordPlan) {
  const faqHtml = faqToHtml(draft.faq ?? []);
  return { faqHtml, issues: [...validateDraft(draft, product, plan), ...validateFaq(faqHtml, product, plan)] };
}

/**
 * Draft, check, and send the problems back once if any check fails. `requestText` replaces
 * the new-draft request (a revision after the store confirmed details uses its own).
 */
export async function draftProduct(
  product: ProductInput,
  plan: KeywordPlan,
  opts: { research: boolean; shopperQuestions?: string[]; requestText?: string },
): Promise<DraftResult> {
  const first = await call(
    [{ role: "user", content: opts.requestText ?? draftRequestText(product, plan, opts) }],
    opts.research,
  );
  let draft = JSON.parse(first.text) as ProductDraft;
  let { faqHtml, issues } = check(draft, product, plan);
  if (!issues.length) return { draft, faqHtml, issues, attempts: 1 };
  const revision = await call(
    [
      ...first.messages,
      {
        role: "user",
        content: `Revise the draft to fix these problems, keeping everything else:\n${issues.map((i) => `- ${i.message}`).join("\n")}`,
      },
    ],
    false,
  );
  draft = JSON.parse(revision.text) as ProductDraft;
  ({ faqHtml, issues } = check(draft, product, plan));
  return { draft, faqHtml, issues, attempts: 2 };
}
