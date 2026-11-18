import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { getBatch, getDecisions } from "@/lib/batches";

export const dynamic = "force-dynamic";

const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/**
 * Approved copy as a Magento product import file (System → Data Transfer → Import,
 * entity Products, behaviour "Add/Update"): sku, description, meta_title,
 * meta_description. The FAQ is appended to the description under a heading.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentUser())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await params;
  const batch = await getBatch(id);
  if (!batch) return NextResponse.json({ error: "Batch not found." }, { status: 404 });
  const decisions = await getDecisions(id);
  const rows = batch.products
    .map((p) => decisions[p.sku])
    .filter((d) => d?.status === "approved")
    .map((d) => {
      const description = d.faq_html
        ? `${d.description_html}<p><strong>Frequently asked questions</strong></p>${d.faq_html}`
        : d.description_html;
      return [d.sku, description, d.meta_title, d.meta_description].map(cell).join(",");
    });
  const csv = ["sku,description,meta_title,meta_description", ...rows].join("\n") + "\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="surplus-approved-${id}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
