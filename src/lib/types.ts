import type { Competitor } from "./competitors/teppermans";
import type { DataAsk, FixState } from "./copy/data-asks";
import type { FaqGap, ProductInput } from "./copy/rules";

export type { Competitor, DataAsk, FixState };

/** One product in a weekly batch: the data, the keywords and the suggested copy. */
export interface BatchProduct {
  sku: string;
  name: string;
  brand?: string;
  url?: string;
  image?: string;
  category: string | null;
  created: string;
  /** "seo" = an existing description gets an SEO pass; "thin" = little or no description. */
  kind: "seo" | "thin";
  reasons: string[];
  currentText: string;
  primary: { keyword: string; volume: number } | null;
  secondary: { keyword: string; volume: number }[];
  draft: {
    description_html: string;
    meta_title: string;
    meta_description: string;
    faq_html: string;
  };
  note: string;
  faqGaps: FaqGap[];
  competitors: Competitor[];
  checksPassed: boolean;
  issues: string[];
  /** The feed data the draft was written from, so it can be rewritten later. */
  input?: ProductInput;
  /** Details the store's developer can add in Magento (the Magento to-do list). */
  dataAsks?: DataAsk[];
  /** Set when the copy was rewritten after the developer confirmed details. */
  revision?: RevisionInfo;
}

/** The latest rewrite of one product's copy, stored apart from the batch. */
export interface Revision {
  sku: string;
  state: "running" | "done" | "failed";
  /** Identifies the rewrite in progress, so an older one finishing late can't overwrite it. */
  requestId: string;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  /** The details worked in, e.g. { "Drawer count": "2 drawers" }. */
  facts: Record<string, string>;
  /** Present once a rewrite has succeeded (kept from the last success if a later one fails). */
  result?: {
    draft: BatchProduct["draft"];
    primary: BatchProduct["primary"];
    secondary: BatchProduct["secondary"];
    note: string;
    faqGaps: FaqGap[];
    checksPassed: boolean;
    issues: string[];
    facts: Record<string, string>;
    at: string;
  };
}

export type RevisionInfo = Pick<Revision, "state" | "startedAt" | "finishedAt" | "error"> & {
  /** Details in the copy now, and when that copy was written. */
  facts: Record<string, string>;
  at?: string;
};

export interface Batch {
  id: string;
  createdAt: string;
  /** Where the products came from, e.g. "Google Merchant Center via Windsor". */
  source: string;
  products: BatchProduct[];
  /** Products the run skipped (drafting failed), so a person can look. */
  failures?: { sku: string; name: string; error: string }[];
}

export type DecisionStatus = "approved" | "rejected";

export interface Decision {
  sku: string;
  status: DecisionStatus;
  description_html: string;
  meta_title: string;
  meta_description: string;
  faq_html: string;
  edited: boolean;
  reason: string;
  by: string;
  at: string;
}

export interface BatchSummary {
  id: string;
  createdAt: string;
  source: string;
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  /** Magento to-do items not yet checked off. */
  magentoOpen: number;
}
