import { notFound, redirect } from "next/navigation";
import { currentUser, isStaff } from "@/lib/auth";
import { getBatch, getDecisions, getFixes } from "@/lib/batches";
import { TopBar } from "../../components/TopBar";
import { Template } from "../../components/Template";
import { ReviewBoard } from "../../components/ReviewBoard";
import { Footer } from "../../components/Footer";

export const dynamic = "force-dynamic";

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Toronto" });

export default async function BatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sku = (await searchParams).sku;
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/batches/${id}`)}`);
  const batch = await getBatch(id);
  if (!batch) notFound();
  const [decisions, fixes] = await Promise.all([getDecisions(id), getFixes(id)]);
  const closed = new Set(fixes.map((f) => `${f.sku}/${f.askId}`));
  const magentoOpen = Object.fromEntries(
    batch.products.map((p) => [p.sku, (p.dataAsks ?? []).filter((a) => !closed.has(`${p.sku}/${a.id}`)).length]),
  );
  return (
    <>
      <TopBar user={user} active="descriptions" />
      <ReviewBoard
        batch={batch}
        weekLabel={dateLabel(batch.createdAt)}
        initialDecisions={decisions}
        staff={isStaff(user)}
        magentoOpen={magentoOpen}
        initialSku={typeof sku === "string" ? sku : undefined}
        template={<Template />}
      />
      <Footer />
    </>
  );
}
