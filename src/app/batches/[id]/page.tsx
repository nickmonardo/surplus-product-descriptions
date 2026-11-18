import { notFound, redirect } from "next/navigation";
import { currentUser, isStaff } from "@/lib/auth";
import { getBatch, getDecisions } from "@/lib/batches";
import { TopBar } from "../../components/TopBar";
import { Template } from "../../components/Template";
import { ReviewBoard } from "../../components/ReviewBoard";

export const dynamic = "force-dynamic";

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Toronto" });

export default async function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/batches/${id}`)}`);
  const batch = await getBatch(id);
  if (!batch) notFound();
  const decisions = await getDecisions(id);
  return (
    <>
      <TopBar user={user} crumb={`Week of ${dateLabel(batch.createdAt)}`} />
      <ReviewBoard batch={batch} initialDecisions={decisions} staff={isStaff(user)} template={<Template />} />
    </>
  );
}
