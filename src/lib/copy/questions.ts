// Shopper questions by product type, for the FAQ. Category entries come from Semrush's
// question report for Google.ca (2026-11-17); the default list covers what shoppers ask
// about any piece of furniture. The model answers only those its data supports and lists
// the rest as gaps for the client.

const DEFAULT_QUESTIONS = [
  "What are the dimensions?",
  "What is it made of?",
  "Is assembly required?",
  "How do I clean and care for it?",
  "What's the weight capacity?",
];

const BY_CATEGORY: Record<string, string[]> = {
  "bunk-bed": [
    "What size mattresses and sheets does it need?",
    "Is there a weight limit?",
    "Are bunk beds safe? Does it have guardrails?",
    "What are the dimensions?",
  ],
  "loft-bed": ["What size mattress does it take?", "Is there a weight limit?", "What are the dimensions?", "Is assembly required?"],
  recliner: [
    "Does it swivel, glide or rock?",
    "Is it manual or power reclining?",
    "How much space does it need to recline?",
    "How do I clean it?",
  ],
  mattress: ["How firm is it?", "What is it made of?", "Does it come in a box?", "Does it need a box spring or foundation?"],
  "bed-frame": ["Which mattress sizes does it fit?", "Does it have a centre support?", "What's the weight capacity?", "Is assembly required?"],
  "dining-set": ["How many people does it seat?", "What's included in the set?", "What are the table dimensions?", "What is it made of?"],
  sectional: ["Can the chaise go on either side?", "What are the dimensions?", "What is the fabric?", "How do I clean it?"],
  sofa: ["What's included?", "What are the dimensions?", "What is the fabric?", "How do I clean it?"],
};

export function shopperQuestions(categoryId: string | null | undefined): string[] {
  return (categoryId && BY_CATEGORY[categoryId]) || DEFAULT_QUESTIONS;
}
