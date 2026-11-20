"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { DataAsk, FixState, RevisionInfo } from "@/lib/types";

export interface TodoProduct {
  batchId: string;
  week: string;
  sku: string;
  name: string;
  image?: string;
  url?: string;
  asks: DataAsk[];
  fixes: Record<string, FixState>;
  revision: RevisionInfo | null;
}

type Filter = "open" | "done" | "all";

const fmt = (n: number) => n.toLocaleString("en-CA");
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });

async function post(body: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/fixes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: json.error ?? `HTTP ${res.status}` };
}

function factsLabel(facts: Record<string, string>) {
  return Object.entries(facts)
    .map(([k, v]) => `${k.toLowerCase()} (${v})`)
    .join(", ");
}

function RewriteStatus({ product, onRetry, busy }: { product: TodoProduct; onRetry: () => void; busy: boolean }) {
  const r = product.revision;
  if (!r) return null;
  const review = (
    <Link href={`/batches/${product.batchId}?sku=${encodeURIComponent(product.sku)}`}>See the description</Link>
  );
  if (r.state === "running") {
    return (
      <p className="rewrite running" role="status">
        <span className="spinner" aria-hidden="true" /> Rewriting the description with what you added. This takes about a minute.
      </p>
    );
  }
  if (r.state === "failed") {
    return (
      <p className="rewrite failed" role="alert">
        Couldn&apos;t rewrite the description: {r.error ?? "unknown error"}.{" "}
        <button className="btn link" disabled={busy} onClick={onRetry}>
          Try again
        </button>
      </p>
    );
  }
  return (
    <p className="rewrite done">
      ✓ Description rewritten{r.at ? ` ${when(r.at)}` : ""} with {factsLabel(r.facts)}. It&apos;s back in the review list. {review}
    </p>
  );
}

function Item({
  product,
  ask,
  fix,
  onSaved,
}: {
  product: TodoProduct;
  ask: DataAsk;
  fix: FixState | undefined;
  onSaved: () => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputId = `v-${product.batchId}-${product.sku}-${ask.id}`;

  async function act(action: "done" | "not_applicable" | "reopen") {
    setBusy(true);
    setError("");
    const res = await post({ batchId: product.batchId, sku: product.sku, askId: ask.id, action, value });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Couldn't save");
    setValue("");
    onSaved();
  }

  return (
    <li className="todo-item" data-state={fix ? fix.status : "open"}>
      <div className="todo-text">
        <div className="todo-field">
          <span className="todo-check" aria-hidden="true">
            {fix ? (fix.status === "done" ? "✓" : "–") : ""}
          </span>
          <b>{ask.field}</b>
          {ask.keyword ? (
            <span className="chip">
              {ask.keyword.keyword} <span className="v">{fmt(ask.keyword.volume)}/mo</span>
            </span>
          ) : null}
        </div>
        <p className="todo-ask">
          {ask.ask} <span className="muted">{ask.why}</span>
        </p>
      </div>
      {fix ? (
        <div className="todo-closed">
          <span>
            {fix.status === "done" ? (
              fix.value ? (
                <>
                  Added: <b>{fix.value}</b>
                </>
              ) : (
                "Done"
              )
            ) : (
              "Doesn't apply"
            )}{" "}
            <span className="muted">
              · {fix.by} · {when(fix.at)}
            </span>
          </span>
          <button className="btn link" disabled={busy} onClick={() => act("reopen")}>
            Reopen
          </button>
        </div>
      ) : (
        <form
          className="todo-form"
          onSubmit={(e) => {
            e.preventDefault();
            void act("done");
          }}
        >
          {ask.needsValue ? (
            <>
              <label className="sr-only" htmlFor={inputId}>
                {ask.field} as added in Magento
              </label>
              <input
                id={inputId}
                value={value}
                maxLength={500}
                placeholder={ask.placeholder ?? "What you added"}
                onChange={(e) => setValue(e.target.value)}
              />
            </>
          ) : null}
          <button className="btn approve" type="submit" disabled={busy || (ask.needsValue && !value.trim())}>
            {ask.needsValue ? "Done" : "Mark done"}
          </button>
          <button className="btn link" type="button" disabled={busy} onClick={() => act("not_applicable")}>
            Doesn&apos;t apply
          </button>
        </form>
      )}
      {error ? (
        <p className="reject-reason" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export function MagentoList({ products }: { products: TodoProduct[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("open");
  const [retrying, setRetrying] = useState("");
  const running = products.some((p) => p.revision?.state === "running");

  // While a rewrite runs, refresh every few seconds so its result shows up.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [running, router]);

  const isOpen = (p: TodoProduct, a: DataAsk) => !p.fixes[a.id];
  const counts = { open: 0, done: 0, all: 0 };
  for (const p of products)
    for (const a of p.asks) {
      counts.all++;
      counts[isOpen(p, a) ? "open" : "done"]++;
    }
  const shown = products
    .map((p) => ({ ...p, visible: p.asks.filter((a) => filter === "all" || (filter === "open") === isOpen(p, a)) }))
    .filter((p) => p.visible.length || (filter !== "open" && p.revision));

  async function retry(p: TodoProduct) {
    setRetrying(`${p.batchId}/${p.sku}`);
    await post({ batchId: p.batchId, sku: p.sku, action: "rewrite" });
    setRetrying("");
    router.refresh();
  }

  if (!products.length) {
    return <p className="empty">Nothing to add in Magento yet. New items show up here with each weekly batch.</p>;
  }

  return (
    <>
      <div className="section-header">
        <h2>Details to add</h2>
      </div>
      <div className="filter-bar" role="group" aria-label="Show">
        {(
          [
            ["open", "Open"],
            ["done", "Done"],
            ["all", "All"],
          ] as const
        ).map(([f, label]) => (
          <button key={f} className="tab" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {label} <span className="n">{counts[f]}</span>
          </button>
        ))}
      </div>
      {shown.length ? (
        <div className="list">
          {shown.map((p) => (
            <article className="card todo-card" key={`${p.batchId}/${p.sku}`}>
              <div className="card-head">
                <div className="head-main">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="product-img"
                      src={p.image}
                      alt=""
                      width={64}
                      height={64}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : null}
                  <div>
                    <h3>{p.name}</h3>
                    <div className="meta">
                      <span className="mono">SKU {p.sku}</span>
                      <span>Week of {p.week}</span>
                      {p.url ? (
                        <a href={p.url} target="_blank" rel="noreferrer">
                          Product page ↗
                        </a>
                      ) : null}
                      <Link href={`/batches/${p.batchId}?sku=${encodeURIComponent(p.sku)}`}>Description</Link>
                    </div>
                  </div>
                </div>
              </div>
              <RewriteStatus product={p} busy={retrying === `${p.batchId}/${p.sku}`} onRetry={() => retry(p)} />
              {p.visible.length ? (
                <ul className="todo-list">
                  {p.visible.map((a) => (
                    <Item key={a.id} product={p} ask={a} fix={p.fixes[a.id]} onSaved={() => router.refresh()} />
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="empty">{filter === "open" ? "All done. Nothing left to add in Magento." : "Nothing checked off yet."}</p>
      )}
    </>
  );
}
