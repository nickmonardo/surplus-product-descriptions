"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { sanitizeCopyHtml, stripHtml } from "@/lib/copy/rules";
import type { Batch, BatchProduct, Decision } from "@/lib/types";
import { Hero } from "./Hero";

type Mode = "view" | "edit" | "reject";
type Tab = "description" | "faq" | "competitors";
type Filter = "all" | "pending" | "approved" | "rejected";
type Copy = { description_html: string; meta_title: string; meta_description: string; faq_html: string };

const LIMITS = { title: 60, metaMin: 120, metaMax: 155 };
const fmt = (n: number) => n.toLocaleString("en-CA");
const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const norm = (s: string) =>
  " " + s.toLowerCase().replace(/&/g, "and").replace(/\bgray\b/g, "grey").replace(/[^a-z0-9.]+/g, " ") + " ";
const hasKeyword = (text: string, kw: string) => {
  const n = norm(text);
  const k = norm(kw).trim();
  return n.includes(` ${k} `) || n.includes(` ${k}s `);
};
const hasDims = (text: string) => /\d+(\.\d+)?\s*("|”|in\b|inch)/i.test(text);
const dateLabel = (iso: string) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : "";
const countClass = (len: number, min: number, max: number) => (len >= min && len <= max ? "count good" : "count off");

function YesNo({ value }: { value?: boolean }) {
  return value ? <span className="yes">Yes</span> : <span className="no">No</span>;
}

function Serp({ url, title, meta }: { url?: string; title: string; meta: string }) {
  const path = url ? new URL(url).pathname.replace(/^\//, "") : "";
  return (
    <div className="serp-box" aria-label="Google search preview">
      <div className="serp-site">
        surplusfurniture.com <span className="crumb">› {path}</span>
      </div>
      <div className="serp-title">{title}</div>
      <div className="serp-desc">{meta}</div>
    </div>
  );
}

function Rivals({ product, copy }: { product: BatchProduct; copy: Copy }) {
  if (!product.competitors.length || !product.primary) return null;
  const kw = product.primary.keyword;
  const suggested = stripHtml(copy.description_html);
  return (
    <div className="rivals">
      <p className="muted" style={{ fontSize: 13 }}>
        Read from competitors&apos; product pages when this batch was drafted. These are their closest equivalents, not the
        same model.
      </p>
      <div className="rivals-scroll">
        <table>
          <thead>
            <tr>
              <th>Retailer</th>
              <th>Words</th>
              <th>Dimensions</th>
              <th>Says “{kw}”</th>
              <th>Excerpt</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="who">Surplus today</td>
              <td className="num">{words(product.currentText)}</td>
              <td><YesNo value={hasDims(product.currentText)} /></td>
              <td><YesNo value={hasKeyword(product.currentText, kw)} /></td>
              <td><span className="excerpt">Your current description</span></td>
            </tr>
            <tr className="ours">
              <td className="who">Surplus, suggested</td>
              <td className="num">{words(suggested)}</td>
              <td><YesNo value={hasDims(suggested)} /></td>
              <td><YesNo value={hasKeyword(suggested, kw)} /></td>
              <td><span className="excerpt">The suggestion above</span></td>
            </tr>
            {product.competitors.map((c, i) =>
              c.missing ? (
                <tr key={i}>
                  <td className="who">{c.site}</td>
                  <td colSpan={4} className="muted">{c.note}</td>
                </tr>
              ) : (
                <tr key={i}>
                  <td className="who">
                    <a href={c.url} target="_blank" rel="noopener noreferrer">{c.site}</a>
                    <span className="cmp">{c.name}</span>
                    <span className={c.same || c.sameBrand ? "same" : "cmp"}>
                      {c.same ? "Same product" : c.sameBrand ? "Same brand · similar product" : "Similar product"}
                    </span>
                  </td>
                  <td className="num">{c.words ?? "–"}</td>
                  <td><YesNo value={c.dimensions} /></td>
                  <td><YesNo value={c.keyword} /></td>
                  <td>
                    {c.excerpt ? <span className="excerpt">“{c.excerpt}”</span> : null}
                    {c.note ? <span className="rival-note">{c.note}</span> : null}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({
  batchId,
  product,
  decision,
  staff,
  onDecision,
}: {
  batchId: string;
  product: BatchProduct;
  decision?: Decision;
  staff: boolean;
  onDecision: (sku: string, d: Decision | null) => void;
}) {
  const [mode, setMode] = useState<Mode>("view");
  const [tab, setTab] = useState<Tab>("description");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [meta, setMeta] = useState("");
  const [reason, setReason] = useState("");
  const [wc, setWc] = useState<number | null>(null);
  // While editing, keystrokes go to these refs (no re-render); switching tabs copies them into
  // state so the reopened tab shows the edited text instead of the original.
  const descDraft = useRef<string | null>(null);
  const faqDraft = useRef<string | null>(null);
  const [descEdit, setDescEdit] = useState<string | null>(null);
  const [faqEdit, setFaqEdit] = useState<string | null>(null);

  function switchTab(next: Tab) {
    if (mode === "edit") {
      setDescEdit(descDraft.current);
      setFaqEdit(faqDraft.current);
    }
    setTab(next);
  }

  const status = decision?.status ?? "pending";
  const copy: Copy = decision?.description_html
    ? { ...decision, faq_html: decision.faq_html ?? product.draft.faq_html }
    : product.draft;
  const descHtml = useMemo(() => sanitizeCopyHtml(copy.description_html), [copy.description_html]);
  const faqHtml = useMemo(() => sanitizeCopyHtml(copy.faq_html ?? ""), [copy.faq_html]);
  const sugWords = wc ?? words(stripHtml(descHtml));
  const editing = mode === "edit";

  async function save(action: "approve" | "reject" | "undo", extra: { copy?: Copy; reason?: string } = {}) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, sku: product.sku, action, ...extra }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setMode("view");
      setWc(null);
      descDraft.current = null;
      faqDraft.current = null;
      onDecision(product.sku, body.decision ?? null);
    } catch (e) {
      setError(`Couldn't save: ${e instanceof Error ? e.message : "try again"}`);
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    setTitle(copy.meta_title);
    setMeta(copy.meta_description);
    descDraft.current = descHtml;
    faqDraft.current = faqHtml;
    setDescEdit(descHtml);
    setFaqEdit(faqHtml);
    setMode("edit");
  }

  function cancelEdit() {
    setMode("view");
    setWc(null);
    descDraft.current = null;
    faqDraft.current = null;
  }

  function saveEdit() {
    save("approve", {
      copy: {
        description_html: sanitizeCopyHtml(descDraft.current ?? copy.description_html),
        faq_html: sanitizeCopyHtml(faqDraft.current ?? copy.faq_html ?? ""),
        meta_title: title.trim(),
        meta_description: meta.trim(),
      },
    });
  }

  const statusLabel = { pending: "To review", approved: decision?.edited ? "Approved with edits" : "Approved", rejected: "Rejected" }[status];
  const when = decision?.at
    ? new Date(decision.at).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";
  const tabs: { id: Tab; label: string }[] = [
    { id: "description", label: "Description & Google preview" },
    ...(faqHtml ? [{ id: "faq" as Tab, label: `FAQ${product.faqGaps.length && status === "pending" ? " · needs you" : ""}` }] : []),
    ...(product.competitors.length && product.primary ? [{ id: "competitors" as Tab, label: "Competitors" }] : []),
  ];

  const actions = (
    <div className="actions">
      {editing ? (
        <>
          <button className="btn approve" disabled={saving} onClick={saveEdit}>
            Save and approve
          </button>
          <button className="btn link" onClick={cancelEdit}>
            Cancel
          </button>
          <span className="decision">Click into the text to change it. Edits in every tab are kept until you save.</span>
        </>
      ) : mode === "reject" ? (
        <span className="decision">Rejecting sends this product back for a new draft.</span>
      ) : status === "pending" ? (
        <>
          <button className="btn approve" disabled={saving} onClick={() => save("approve")}>
            Approve
          </button>
          <button className="btn" disabled={saving} onClick={startEdit}>
            Edit
          </button>
          <button className="btn reject" disabled={saving} onClick={() => setMode("reject")}>
            Reject
          </button>
        </>
      ) : (
        <>
          <span className="decision">
            {status === "approved" ? "Approved" : "Rejected"} by {decision?.by}
            {when ? ` on ${when}` : ""}
            {when.endsWith(".") ? "" : "."}
            {status === "approved" ? " Ready to publish to the product page." : ""}
          </span>
          {status === "rejected" && decision?.reason ? <span className="reject-reason">“{decision.reason}”</span> : null}
          <button className="btn link" disabled={saving} onClick={() => save("undo")}>
            Undo
          </button>
        </>
      )}
      {error ? (
        <span className="reject-reason" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );

  return (
    <article className="card" data-status={status} id={`card-${product.sku}`}>
      <div className="card-head">
        <div className="head-main">
          {product.image ? (
            // Product photos come from the store's own media URLs.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="product-img"
              src={product.image}
              alt=""
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : null}
          <div style={{ minWidth: 0 }}>
            <h3>{product.name}</h3>
            <div className="meta">
              <span className={`tag ${product.kind}`}>{product.kind === "seo" ? "New arrival · SEO pass" : "Thin description"}</span>
              <span className="mono">SKU {product.sku}</span>
              {product.category ? <span>{product.category}</span> : null}
              {product.created ? <span>Added {dateLabel(product.created)}</span> : null}
              {product.url ? (
                <a href={product.url} target="_blank" rel="noopener noreferrer">
                  View on site
                </a>
              ) : null}
            </div>
          </div>
        </div>
        <span className={`pill ${status}`}>{statusLabel}</span>
      </div>

      {actions}

      {mode === "reject" ? (
        <div className="reject-box">
          <label htmlFor={`reason-${product.sku}`}>What should change? (optional)</label>
          <textarea
            id={`reason-${product.sku}`}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="For example: it's not solid wood, or mention the matching bed"
            autoFocus
          />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn reject" disabled={saving} onClick={() => save("reject", { reason })}>
              Reject suggestion
            </button>
            <button className="btn link" onClick={() => setMode("view")}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {product.primary ? (
        <div className="kw">
          <span className="label">Keywords</span>
          <span className="chip primary" title="Target keyword">
            {product.primary.keyword} <span className="v">{fmt(product.primary.volume)}/mo</span>
          </span>
          {product.secondary.map((k) => (
            <span className="chip" key={k.keyword}>
              {k.keyword} <span className="v">{fmt(k.volume)}/mo</span>
            </span>
          ))}
        </div>
      ) : null}

      <div className="card-tabs" role="tablist" aria-label="Product details">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${product.sku}-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${product.sku}`}
            className="card-tab"
            onClick={() => switchTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${product.sku}`} aria-labelledby={`tab-${product.sku}-${tab}`}>
        {tab === "description" ? (
          <>
            <div className="compare">
              <div className="pane">
                <div className="pane-title">
                  Current description <span className="wordcount">{words(product.currentText)} words</span>
                </div>
                <p className="current-text">{product.currentText || "No description yet."}</p>
              </div>
              <div className="pane suggested">
                <div className="pane-title">
                  {editing ? "Editing suggested description" : status === "pending" ? "Suggested description" : "Approved description"}
                  <span className="wordcount">{sugWords} words</span>
                </div>
                <div
                  key={`desc-${mode}-${decision?.at ?? ""}`}
                  className="desc"
                  contentEditable={editing}
                  suppressContentEditableWarning
                  spellCheck={editing}
                  onInput={(e) => {
                    descDraft.current = e.currentTarget.innerHTML;
                    setWc(words(e.currentTarget.textContent ?? ""));
                  }}
                  dangerouslySetInnerHTML={{ __html: editing ? descEdit ?? descHtml : descHtml }}
                />
                {product.note && status === "pending" ? (
                  <div className="note">
                    <b>Note:</b>{" "}{product.note}
                  </div>
                ) : null}
                {staff && product.issues.length ? (
                  <div className="issues">
                    <b>Checks still flag (TIA only):</b>
                    <ul>
                      {product.issues.map((i) => (
                        <li key={i}>{i}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="serp">
              {editing ? (
                <>
                  <div className="pane-title">Search listing</div>
                  <div className="fields">
                    <div className="field">
                      <label htmlFor={`title-${product.sku}`}>
                        Meta title <span className={countClass(title.length, 1, LIMITS.title)}>{title.length} / {LIMITS.title}</span>
                      </label>
                      <input id={`title-${product.sku}`} value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                    <div className="field">
                      <label htmlFor={`meta-${product.sku}`}>
                        Meta description{" "}
                        <span className={countClass(meta.length, LIMITS.metaMin, LIMITS.metaMax)}>
                          {meta.length} / {LIMITS.metaMin}–{LIMITS.metaMax}
                        </span>
                      </label>
                      <textarea id={`meta-${product.sku}`} rows={3} value={meta} onChange={(e) => setMeta(e.target.value)} />
                    </div>
                  </div>
                  <Serp url={product.url} title={title} meta={meta} />
                </>
              ) : (
                <>
                  <div className="pane-title">
                    How it looks in Google{" "}
                    <span className="wordcount">
                      title {copy.meta_title.length}/{LIMITS.title} · description {copy.meta_description.length} characters
                    </span>
                  </div>
                  <Serp url={product.url} title={copy.meta_title} meta={copy.meta_description} />
                </>
              )}
            </div>
          </>
        ) : null}

        {tab === "faq" ? (
          <div className="tab-body">
            <div className="pane-title">
              Product FAQ <span className="wordcount">added below the description on the product page</span>
            </div>
            <div
              key={`faq-${mode}-${decision?.at ?? ""}`}
              className="desc faq-body"
              contentEditable={editing}
              suppressContentEditableWarning
              spellCheck={editing}
              onInput={(e) => {
                faqDraft.current = e.currentTarget.innerHTML;
              }}
              dangerouslySetInnerHTML={{ __html: editing ? faqEdit ?? faqHtml : faqHtml }}
            />
            {product.faqGaps.length && status === "pending" ? (
              <div className="note">
                <b>Needs from you:</b>{" "}shoppers also ask these, but the product data can&apos;t answer them yet.
                <ul className="gaps">
                  {product.faqGaps.map((g) => (
                    <li key={g.q}>
                      <b>{g.q}</b>
                      <span className="why">{g.why}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "competitors" ? <Rivals product={product} copy={copy} /> : null}
      </div>
    </article>
  );
}

const isTyping = (el: Element | null) =>
  !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable);

export function ReviewBoard({
  batch,
  weekLabel,
  initialDecisions,
  staff,
  template,
}: {
  batch: Batch;
  weekLabel: string;
  initialDecisions: Record<string, Decision>;
  staff: boolean;
  template: ReactNode;
}) {
  const [decisions, setDecisions] = useState(initialDecisions);
  const [filter, setFilter] = useState<Filter>("all");
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState("");
  const statusOf = (sku: string) => decisions[sku]?.status ?? "pending";
  const counts = { all: batch.products.length, pending: 0, approved: 0, rejected: 0 };
  for (const p of batch.products) counts[statusOf(p.sku)]++;
  const thin = batch.products.filter((p) => p.kind === "thin").length;
  const seo = batch.products.length - thin;
  const shown = batch.products.filter((p) => filter === "all" || statusOf(p.sku) === filter);
  const current = Math.min(index, Math.max(shown.length - 1, 0));
  const product = shown[current];

  const go = useCallback((delta: number) => {
    setSaved("");
    setIndex((i) => Math.max(0, Math.min(i + delta, shown.length - 1)));
    window.scrollTo({ top: document.getElementById("review")?.offsetTop ?? 0, behavior: "smooth" });
  }, [shown.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const onDecision = (sku: string, d: Decision | null) => {
    setDecisions((prev) => {
      const next = { ...prev };
      if (d) next[sku] = d;
      else delete next[sku];
      return next;
    });
    if (!d) {
      setSaved("");
      return;
    }
    const name = batch.products.find((p) => p.sku === sku)?.name ?? sku;
    setSaved(`${d.status === "approved" ? "Approved" : "Rejected"}: ${name}.`);
    // Move on to the next product; on the "To review" filter the list shrinks instead.
    if (filter !== "pending" && current < shown.length - 1) setIndex(current + 1);
  };

  return (
    <>
      <Hero
        micro={`Surplus Furniture · Week of ${weekLabel}`}
        title="Ready for"
        accent="review"
        intro={
          <>
            {batch.products.length} products from your Google Merchant Center feed: {seo} new arrival{seo === 1 ? "" : "s"} that get an
            SEO pass on their existing copy, and {thin} with thin descriptions. Approve each suggestion as written, edit the
            wording, or reject it with a note.
          </>
        }
        stats={[
          { value: counts.all, label: "products" },
          { value: counts.pending, label: "to review" },
          { value: counts.approved, label: "approved" },
          { value: counts.rejected, label: "rejected" },
        ]}
      />
      <main className="page">
        {template}
        <div className="section-header" id="review">
          <span className="section-num">2</span>
          <h2>Review products</h2>
        </div>
        <div className="divider" />
        <div className="filter-bar" role="group" aria-label="Filter products">
          {(["all", "pending", "approved", "rejected"] as const).map((f) => (
            <button
              key={f}
              className="tab"
              aria-pressed={filter === f}
              onClick={() => {
                setFilter(f);
                setIndex(0);
                setSaved("");
              }}
            >
              {{ all: "All", pending: "To review", approved: "Approved", rejected: "Rejected" }[f]} <span className="n">{counts[f]}</span>
            </button>
          ))}
          {counts.approved ? (
            <a className="btn primary export" href={`/api/batches/${batch.id}/export`}>
              Download approved copy (Magento CSV)
            </a>
          ) : null}
        </div>

        {product ? (
          <>
            <nav className="stepper" aria-label="Products in this batch">
              <button className="btn step-btn" onClick={() => go(-1)} disabled={current === 0}>
                ← Previous
              </button>
              <div className="step-dots">
                {shown.map((p, i) => (
                  <button
                    key={p.sku}
                    className={`step-dot ${statusOf(p.sku)}`}
                    aria-current={i === current ? "true" : undefined}
                    aria-label={`Product ${i + 1}: ${p.name} (${{ pending: "to review", approved: "approved", rejected: "rejected" }[statusOf(p.sku)]})`}
                    title={p.name}
                    onClick={() => {
                      setSaved("");
                      setIndex(i);
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <span className="step-count">
                Product {current + 1} of {shown.length}
              </span>
              <button className="btn step-btn primary" onClick={() => go(1)} disabled={current >= shown.length - 1}>
                Next →
              </button>
            </nav>
            {saved ? (
              <p className="saved-line" role="status">
                ✓ {saved}
              </p>
            ) : null}
            <Card key={product.sku} batchId={batch.id} product={product} decision={decisions[product.sku]} staff={staff} onDecision={onDecision} />
            <div className="stepper bottom">
              <button className="btn step-btn" onClick={() => go(-1)} disabled={current === 0}>
                ← Previous
              </button>
              <span className="step-count">Use ← and → keys to move between products</span>
              <button className="btn step-btn primary" onClick={() => go(1)} disabled={current >= shown.length - 1}>
                Next →
              </button>
            </div>
          </>
        ) : (
          <div className="empty">{filter === "pending" ? "Everything in this batch has been reviewed." : "No products here yet."}</div>
        )}

        {staff && batch.failures?.length ? (
          <section className="failures">
            <b>Not drafted this run (TIA only):</b>
            <ul>
              {batch.failures.map((f) => (
                <li key={f.sku}>
                  {f.name} ({f.sku}): {f.error}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <p className="page-note">
          Products and current descriptions come from your Google Merchant Center feed. Keyword volumes are monthly Google.ca
          searches from Semrush. Approved copy can be downloaded as a Magento import file; once the store&apos;s API is
          connected, it will be written to the product directly.
        </p>
      </main>
    </>
  );
}
