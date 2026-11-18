"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** TIA staff: list this week's candidates, or run the weekly batch now. */
export function RunButton() {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "dry" | "run">("");
  const [message, setMessage] = useState("");

  async function run(dry: boolean) {
    setBusy(dry ? "dry" : "run");
    setMessage(dry ? "Checking the feed…" : "Drafting this week's batch. This can take a few minutes…");
    try {
      const res = await fetch(`/api/cron/weekly${dry ? "?dry=1" : ""}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (dry) {
        setMessage(
          body.candidates.length
            ? `${body.candidates.length} products would be drafted: ${body.candidates.map((c: { name: string }) => c.name).slice(0, 5).join("; ")}${body.candidates.length > 5 ? "…" : ""}`
            : "Nothing new or thin to draft right now.",
        );
      } else {
        setMessage(
          body.batchId
            ? `Drafted ${body.drafted} products${body.failed ? `, ${body.failed} failed` : ""}${body.deferred ? `, ${body.deferred} left for next run` : ""}.`
            : "Nothing new or thin to draft right now.",
        );
        router.refresh();
      }
    } catch (error) {
      setMessage(`Couldn't run: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="toolbar">
      <button className="btn" disabled={Boolean(busy)} onClick={() => run(true)} id="run-dry">
        Check feed
      </button>
      <button className="btn primary" disabled={Boolean(busy)} onClick={() => run(false)} id="run-now">
        Run this week&apos;s batch now
      </button>
      {message ? (
        <span className="muted" role="status" style={{ fontSize: 13 }}>
          {message}
        </span>
      ) : null}
    </div>
  );
}
