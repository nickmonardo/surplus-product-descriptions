import { createHmac, timingSafeEqual } from "node:crypto";

// Signed, expiring tokens for email sign-in links and sessions, and the allowlist.
// Pure (no Next.js imports) so it can be unit-tested.

export type TokenKind = "link" | "session";
interface TokenPayload {
  kind: TokenKind;
  email: string;
  exp: number;
}

function secret(): Buffer {
  const value = process.env.AUTH_SECRET ?? "";
  if (value.length < 32) throw new Error("AUTH_SECRET must be set to at least 32 characters.");
  return Buffer.from(value);
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function signToken(kind: TokenKind, email: string, ttlSeconds: number, now = Date.now()): string {
  const payload: TokenPayload = { kind, email: email.toLowerCase(), exp: Math.floor(now / 1000) + ttlSeconds };
  const body = b64(JSON.stringify(payload));
  const sig = b64(createHmac("sha256", secret()).update(`${kind}.${body}`).digest());
  return `${body}.${sig}`;
}

export function verifyToken(token: string, kind: TokenKind, now = Date.now()): string | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(`${kind}.${body}`).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (payload.kind !== kind || typeof payload.email !== "string" || payload.exp * 1000 < now) return null;
  // Access can be withdrawn by removing an address from the allowlist, even mid-session.
  return isAllowedEmail(payload.email) ? payload.email : null;
}

const listEnv = (name: string) =>
  (process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export function isAllowedEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
  const domains = listEnv("ALLOWED_DOMAINS");
  const domain = e.split("@")[1];
  return (domains.length ? domains : ["theinfluenceagency.com"]).includes(domain) || listEnv("REVIEWER_EMAILS").includes(e);
}

/** TIA staff (allowed by domain) can run the pipeline and see failures; reviewers review. */
export function isStaff(email: string): boolean {
  const domains = listEnv("ALLOWED_DOMAINS");
  return (domains.length ? domains : ["theinfluenceagency.com"]).includes(email.split("@")[1] ?? "");
}

