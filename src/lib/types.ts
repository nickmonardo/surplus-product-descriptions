import type { Competitor } from "./competitors/teppermans";
import type { FaqGap } from "./copy/rules";

export type { Competitor };

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
}

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
}
