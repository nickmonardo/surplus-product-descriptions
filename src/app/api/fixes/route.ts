import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { clearFix, getBatch, isBatchId, isSku, saveFix } from "@/lib/batches";
import { isAskId } from "@/lib/copy/data-asks";
import { runRewrite, startRewrite } from "@/lib/rewrite";

export const dynamic = "force-dynamic";
// The rewrite runs after the response, inside this function's time limit.
export const maxDuration = 300;

const Body = z.object({
  batchId: z.string().refine(isBatchId),
  sku: z.string().refine(isSku),
  askId: z.string().refine(isAskId).optional(),
  action: z.enum(["done", "not_applicable", "reopen", "rewrite"]),
  value: z.string().max(500).optional(),
});

const noStore = { "Cache-Control": "no-store" };

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  return !origin || origin === req.nextUrl.origin;
}

/**
 * Check off a Magento to-do item (done, with the value when it has one, or "doesn't apply"),
 * reopen it, or retry a product's rewrite. A done item with a value rewrites the product's
 * copy with every detail confirmed so far, after the response.
 */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in again to save." }, { status: 401, headers: noStore });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Not allowed" }, { status: 403, headers: noStore });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That request wasn't valid." }, { status: 400, headers: noStore });
  const { batchId, sku, askId, action } = parsed.data;
  const value = (parsed.data.value ?? "").replace(/\s+/g, " ").trim();

  const batch = await getBatch(batchId);
  const product = batch?.products.find((p) => p.sku === sku);
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404, headers: noStore });

  let rewrite = action === "rewrite";
  if (action !== "rewrite") {
    const ask = product.dataAsks?.find((a) => a.id === askId);
    if (!ask || !askId) return NextResponse.json({ error: "That item isn't on the list." }, { status: 404, headers: noStore });
    if (action === "reopen") {
      await clearFix(batchId, sku, askId);
    } else {
      if (action === "done" && ask.needsValue && !value) {
        return NextResponse.json({ error: "Enter what you added, so the description can use it." }, { status: 400, headers: noStore });
      }
      await saveFix({
        batchId,
        sku,
        askId,
        status: action,
        value: action === "done" ? value : "",
        by: user,
        at: new Date().toISOString(),
      });
      rewrite = action === "done" && ask.needsValue;
    }
  }

  const requestId = rewrite ? await startRewrite(batchId, sku) : null;
  if (requestId) after(() => runRewrite(batchId, sku, requestId));
  return NextResponse.json({ ok: true, rewriting: Boolean(requestId) }, { headers: noStore });
}
