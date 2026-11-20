import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getFixes, listBatches } from "@/lib/batches";
import { TopBar } from "../components/TopBar";
import { Hero } from "../components/Hero";
import { Footer } from "../components/Footer";
import { MagentoList, type TodoProduct } from "../components/MagentoList";

export const dynamic = "force-dynamic";

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Toronto" });

export default async function MagentoTodo() {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/magento")}`);
  const batches = await listBatches();
  const products: TodoProduct[] = [];
  for (const batch of batches) {
    const withAsks = batch.products.filter((p) => p.dataAsks?.length);
    if (!withAsks.length) continue;
    const fixes = await getFixes(batch.id);
    for (const p of withAsks) {
      products.push({
        batchId: batch.id,
        week: dateLabel(batch.createdAt),
        sku: p.sku,
        name: p.name,
        image: p.image,
        url: p.url,
        asks: p.dataAsks ?? [],
        fixes: Object.fromEntries(fixes.filter((f) => f.sku === p.sku).map((f) => [f.askId, f])),
        revision: p.revision ?? null,
      });
    }
  }
  const total = products.reduce((n, p) => n + p.asks.length, 0);
  const open = products.reduce((n, p) => n + p.asks.filter((a) => !p.fixes[a.id]).length, 0);
  return (
    <>
      <TopBar user={user} active="magento" />
      <Hero
        micro="Surplus Furniture · For your developer"
        title="Magento"
        accent="to-do"
        intro="Product details missing from the feed that would make the descriptions better. Add each one in Magento, then check it off here with what you added: the product's description is rewritten with it and comes back for review."
        stats={[
          { value: open, label: "open" },
          { value: total - open, label: "done" },
          { value: products.length, label: products.length === 1 ? "product" : "products" },
        ]}
      />
      <main className="page">
        <MagentoList products={products} />
      </main>
      <Footer />
    </>
  );
}
