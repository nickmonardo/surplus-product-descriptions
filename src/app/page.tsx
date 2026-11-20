import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, isStaff } from "@/lib/auth";
import { listBatchSummaries } from "@/lib/batches";
import { TopBar } from "./components/TopBar";
import { Hero } from "./components/Hero";
import { Footer } from "./components/Footer";
import { RunButton } from "./components/RunButton";

export const dynamic = "force-dynamic";

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Toronto" });

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const batches = await listBatchSummaries();
  const pending = batches.reduce((n, b) => n + b.pending, 0);
  const approved = batches.reduce((n, b) => n + b.approved, 0);
  const magentoOpen = batches.reduce((n, b) => n + b.magentoOpen, 0);
  return (
    <>
      <TopBar user={user} active="descriptions" />
      <Hero
        micro="Surplus Furniture · Weekly SEO copy"
        title="Product"
        accent="descriptions"
        intro="Every week, new and thin product pages from your Google Merchant Center feed get a suggested description, meta title, meta description and FAQ for you to review."
        stats={[
          { value: batches.length, label: batches.length === 1 ? "week" : "weeks" },
          { value: pending, label: "to review" },
          { value: approved, label: "approved" },
        ]}
      />
      <main className="page">
        {isStaff(user) ? <RunButton /> : null}
        {magentoOpen ? (
          <Link href="/magento" className="batch-row todo-callout">
            <div>
              <h3>Magento to-do</h3>
              <p className="muted">
                Product details to add in Magento. Each one checked off rewrites that product&apos;s description with it.
              </p>
            </div>
            <span className="pill pending">{magentoOpen} open</span>
          </Link>
        ) : null}
        <div className="section-header">
          <span className="section-num">1</span>
          <h2>Weekly batches</h2>
        </div>
        <div className="divider" />
        <section className="batches" aria-label="Weekly batches">
          {batches.map((b) => (
            <Link key={b.id} href={`/batches/${b.id}`} className="batch-row">
              <div>
                <h3>Week of {dateLabel(b.createdAt)}</h3>
                <p className="muted">
                  {b.total} products · {b.source}
                </p>
              </div>
              <div className="counts">
                {b.pending ? <span className="pill pending">{b.pending} to review</span> : null}
                {b.approved ? <span className="pill approved">{b.approved} approved</span> : null}
                {b.rejected ? <span className="pill rejected">{b.rejected} rejected</span> : null}
              </div>
            </Link>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}
