import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { clearDecision, getBatch, isBatchId, isSku, saveDecision } from "@/lib/batches";
import { sanitizeCopyHtml } from "@/lib/copy/rules";
import type { Decision } from "@/lib/types";

export const dynamic = "force-dynamic";

const Body = z.object({
  batchId: z.string().refine(isBatchId),
  sku: z.string().refine(isSku),
  action: z.enum(["approve", "reject", "undo"]),
  copy: z
    .object({
      description_html: z.string().max(20_000),
      meta_title: z.string().max(300),
      meta_description: z.string().max(1_000),
      faq_html: z.string().max(20_000).optional(),
    })
    .optional(),
  reason: z.string().max(2_000).optional(),
});

const noStore = { "Cache-Control": "no-store" };

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  return !origin || origin === req.nextUrl.origin;
}

/** Approve (as written or edited), reject with an optional note, or undo a decision. */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in again to save." }, { status: 401, headers: noStore });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Not allowed" }, { status: 403, headers: noStore });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That request wasn't valid." }, { status: 400, headers: noStore });
  const { batchId, sku, action, copy, reason } = parsed.data;
  const batch = await getBatch(batchId);
  const product = batch?.products.find((p) => p.sku === sku);
  if (!product) return NextResponse.json({ error: "Product not found in this batch." }, { status: 404, headers: noStore });

  if (action === "undo") {
    await clearDecision(batchId, sku);
    return NextResponse.json({ decision: null }, { headers: noStore });
  }
  const source = copy ?? product.draft;
  const decision: Decision = {
    sku,
    status: action === "approve" ? "approved" : "rejected",
    description_html: sanitizeCopyHtml(source.description_html),
    meta_title: source.meta_title.trim(),
    meta_description: source.meta_description.trim(),
    faq_html: sanitizeCopyHtml(source.faq_html ?? product.draft.faq_html ?? ""),
    edited: Boolean(copy),
    reason: (reason ?? "").trim(),
    by: user,
    at: new Date().toISOString(),
  };
  await saveDecision(batchId, decision);
  return NextResponse.json({ decision }, { headers: noStore });
}
