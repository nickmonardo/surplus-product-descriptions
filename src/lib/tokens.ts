import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Signed, expiring tokens for email sign-in links and sessions, and the allowlist.
// Pure (no Next.js imports) so it can be unit-tested.

export type TokenKind = "link" | "session";
interface TokenPayload {
  kind: TokenKind;
  email: string;
  exp: number;
  /** Link tokens only: a random id, recorded when the link is used so it works once. */
  n?: string;
}

function secret(): Buffer {
  const value = process.env.AUTH_SECRET ?? "";
  if (value.length < 32) throw new Error("AUTH_SECRET must be set to at least 32 characters.");
  return Buffer.from(value);
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function signToken(kind: TokenKind, email: string, ttlSeconds: number, now = Date.now()): string {
  const payload: TokenPayload = {
    kind,
    email: email.toLowerCase(),
    exp: Math.floor(now / 1000) + ttlSeconds,
    ...(kind === "link" ? { n: randomBytes(16).toString("base64url") } : {}),
  };
  const body = b64(JSON.stringify(payload));
  const sig = b64(createHmac("sha256", secret()).update(`${kind}.${body}`).digest());
  return `${body}.${sig}`;
}

/** The email in a valid, unexpired token of this kind whose address is still allowed. */
export function verifyToken(token: string, kind: TokenKind, now = Date.now()): string | null {
  return readToken(token, kind, now)?.email ?? null;
}

/** Like verifyToken, plus the link's single-use id and expiry. Link tokens must carry an id. */
export function readToken(token: string, kind: TokenKind, now = Date.now()): { email: string; nonce?: string; exp: number } | null {
  if (typeof token !== "string" || token.length > 2048) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expected = createHmac("sha256", secret()).update(`${kind}.${body}`).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || payload.kind !== kind || typeof payload.email !== "string" || typeof payload.exp !== "number" || payload.exp * 1000 < now) return null;
  if (kind === "link" && (typeof payload.n !== "string" || payload.n.length < 16)) return null;
  // Access can be withdrawn by removing an address from the allowlist, even mid-session.
  if (!isAllowedEmail(payload.email)) return null;
  return { email: payload.email, exp: payload.exp, ...(payload.n ? { nonce: payload.n } : {}) };
}

/** A storage-safe, non-reversible key for an email address or link id. */
export const storageHash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 40);

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

/**
 * Where to send someone after sign-in: a path on this site, or "/". Rejects absolute and
 * protocol-relative URLs and anything a browser would read as one ("/\\evil.com" and
 * control characters are treated as "//evil.com"), then re-checks by parsing.
 */
export function safeNext(raw: unknown): string {
  if (typeof raw !== "string" || !raw || raw.length > 512) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(raw)) return "/";
  const base = "https://app.invalid";
  try {
    const url = new URL(raw, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}

/** TIA staff (allowed by domain) can run the pipeline and see failures; reviewers review. */
export function isStaff(email: string): boolean {
  const domains = listEnv("ALLOWED_DOMAINS");
  return (domains.length ? domains : ["theinfluenceagency.com"]).includes(email.split("@")[1] ?? "");
}

