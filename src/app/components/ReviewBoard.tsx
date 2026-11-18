"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { sanitizeCopyHtml, stripHtml } from "@/lib/copy/rules";
import type { Batch, BatchProduct, Decision } from "@/lib/types";

type Mode = "view" | "edit" | "reject";
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
      <div className="pane-title">How others describe it</div>
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [meta, setMeta] = useState("");
  const [reason, setReason] = useState("");
  const [wc, setWc] = useState<number | null>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const faqRef = useRef<HTMLDivElement>(null);

  const status = decision?.status ?? "pending";
  const copy: Copy = decision?.description_html
    ? { ...decision, faq_html: decision.faq_html ?? product.draft.faq_html }
    : product.draft;
  const descHtml = useMemo(() => sanitizeCopyHtml(copy.description_html), [copy.description_html]);
  const faqHtml = useMemo(() => sanitizeCopyHtml(copy.faq_html ?? ""), [copy.faq_html]);
  const sugWords = wc ?? words(stripHtml(descHtml));

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
      onDecision(product.sku, body.decision ?? null);
      setMode("view");
      setWc(null);
    } catch (e) {
      setError(`Couldn't save: ${e instanceof Error ? e.message : "try again"}`);
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    setTitle(copy.meta_title);
    setMeta(copy.meta_description);
    setMode("edit");
    setTimeout(() => descRef.current?.focus(), 0);
  }

  function saveEdit() {
    save("approve", {
      copy: {
        description_html: sanitizeCopyHtml(descRef.current?.innerHTML ?? copy.description_html),
        faq_html: sanitizeCopyHtml(faqRef.current?.innerHTML ?? copy.faq_html ?? ""),
        meta_title: title.trim(),
        meta_description: meta.trim(),
      },
    });
  }

  const statusLabel = { pending: "To review", approved: decision?.edited ? "Approved with edits" : "Approved", rejected: "Rejected" }[status];
  const editing = mode === "edit";
  const when = decision?.at
    ? new Date(decision.at).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";

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
              loading="lazy"
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

      <div className="compare">
        <div className="pane">
          <div className="pane-title">
            Current description <span className="wordcount">{words(product.currentText)} words</span>
          </div>
          <p className="current-text">{product.currentText || "No description yet."}</p>
        </div>
        <div className="pane">
          <div className="pane-title">
            {editing ? "Editing suggested description" : status === "pending" ? "Suggested description" : "Approved description"}
            <span className="wordcount">{sugWords} words</span>
          </div>
          <div
            key={`desc-${mode}-${decision?.at ?? ""}`}
            className="desc"
            ref={descRef}
            contentEditable={editing}
            suppressContentEditableWarning
            spellCheck={editing}
            onInput={(e) => setWc(words(e.currentTarget.textContent ?? ""))}
            dangerouslySetInnerHTML={{ __html: descHtml }}
          />
          {faqHtml ? (
            <div className="faq">
              <div className="pane-title">
                Product FAQ <span className="wordcount">added below the description</span>
              </div>
              <div
                key={`faq-${mode}-${decision?.at ?? ""}`}
                className="desc faq-body"
                ref={faqRef}
                contentEditable={editing}
                suppressContentEditableWarning
                spellCheck={editing}
                dangerouslySetInnerHTML={{ __html: faqHtml }}
              />
              {product.faqGaps.length && status === "pending" ? (
                <div className="note">
                  <b>Needs from you:</b> shoppers also ask these, but the product data can&apos;t answer them yet.
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
          {product.note && status === "pending" ? (
            <div className="note">
              <b>Note:</b> {product.note}
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

      <Rivals product={product} copy={copy} />

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

      <div className="actions">
        {editing ? (
          <>
            <button className="btn approve" disabled={saving} onClick={saveEdit}>
              Save and approve
            </button>
            <button className="btn link" onClick={() => { setMode("view"); setWc(null); }}>
              Cancel
            </button>
            <span className="decision">Click into the description or FAQ to change the wording.</span>
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
    </article>
  );
}

export function ReviewBoard({
  batch,
  initialDecisions,
  staff,
  template,
}: {
  batch: Batch;
  initialDecisions: Record<string, Decision>;
  staff: boolean;
  template: ReactNode;
}) {
  const [decisions, setDecisions] = useState(initialDecisions);
  const [filter, setFilter] = useState<Filter>("all");
  const statusOf = (sku: string) => decisions[sku]?.status ?? "pending";
  const counts = { all: batch.products.length, pending: 0, approved: 0, rejected: 0 };
  for (const p of batch.products) counts[statusOf(p.sku)]++;
  const thin = batch.products.filter((p) => p.kind === "thin").length;
  const seo = batch.products.length - thin;
  const shown = batch.products.filter((p) => filter === "all" || statusOf(p.sku) === filter);

  const onDecision = (sku: string, d: Decision | null) =>
    setDecisions((prev) => {
      const next = { ...prev };
      if (d) next[sku] = d;
      else delete next[sku];
      return next;
    });

  return (
    <>
      <header className="top">
        <h1>Product descriptions ready for review</h1>
        <p className="intro">
          {batch.products.length} products from your Google Merchant Center feed: {seo} new arrival{seo === 1 ? "" : "s"} that get an SEO pass on
          their existing copy, and {thin} with thin descriptions. Each suggestion targets a keyword people in Canada search
          for. Approve it as written, edit the wording, or reject it with a note.{" "}
          {counts.pending ? `${counts.pending} still to review.` : "All reviewed."}
        </p>
        <div className="summary" role="group" aria-label="Filter products">
          {(["all", "pending", "approved", "rejected"] as const).map((f) => (
            <button key={f} className="tab" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {{ all: "All", pending: "To review", approved: "Approved", rejected: "Rejected" }[f]} <span className="n">{counts[f]}</span>
            </button>
          ))}
          {counts.approved ? (
            <a className="btn" href={`/api/batches/${batch.id}/export`} style={{ marginLeft: "auto", textDecoration: "none" }}>
              Download approved copy (Magento CSV)
            </a>
          ) : null}
        </div>
      </header>
      {template}
      <section className="list" aria-live="polite">
        {shown.length ? (
          shown.map((p) => (
            <Card key={p.sku} batchId={batch.id} product={p} decision={decisions[p.sku]} staff={staff} onDecision={onDecision} />
          ))
        ) : (
          <div className="empty">No products here yet.</div>
        )}
      </section>
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
      <footer>
        Products and current descriptions come from your Google Merchant Center feed. Keyword volumes are monthly Google.ca
        searches from Semrush. Approved copy can be downloaded as a Magento import file; once the store&apos;s API is
        connected, it will be written to the product directly.
      </footer>
    </>
  );
}
