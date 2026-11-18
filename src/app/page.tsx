import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, isStaff } from "@/lib/auth";
import { listBatchSummaries } from "@/lib/batches";
import { TopBar } from "./components/TopBar";
import { RunButton } from "./components/RunButton";

export const dynamic = "force-dynamic";

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Toronto" });

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const batches = await listBatchSummaries();
  const pending = batches.reduce((n, b) => n + b.pending, 0);
  return (
    <>
      <TopBar user={user} />
      <header className="top">
        <h1>Product descriptions</h1>
        <p className="intro">
          Every week, new and thin product pages from your Google Merchant Center feed get a suggested description, meta
          title, meta description and FAQ. {pending ? `${pending} still to review.` : "Everything has been reviewed."}
        </p>
        {isStaff(user) ? <RunButton /> : null}
      </header>
      <section className="batches" aria-label="Weekly batches">
        {batches.map((b) => (
          <Link key={b.id} href={`/batches/${b.id}`} className="batch-row">
            <div>
              <h2>Week of {dateLabel(b.createdAt)}</h2>
              <p className="muted" style={{ fontSize: 13 }}>
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
    </>
  );
}
