import "server-only";
import { cookies } from "next/headers";
import { isAllowedEmail, isStaff, readToken, safeNext, signToken, storageHash, verifyToken } from "./tokens";
import { createJson, readJson } from "./storage";

// Email sign-in without a database: links and sessions are HMAC-signed tokens
// (AUTH_SECRET), so nothing is stored. Allowed: any address at ALLOWED_DOMAINS
// (default theinfluenceagency.com) plus each address in REVIEWER_EMAILS (Surplus reviewers).
// A link works once, until it expires (15 minutes from the sign-in page, 3 days in the
// weekly email). Opening it shows a Continue button; only pressing it (a POST) uses the
// link, so email security scanners that open links can neither use nor burn it.

export { isAllowedEmail, isStaff, readToken, safeNext, signToken, verifyToken };

export const SESSION_COOKIE = "spd_session";
const SESSION_DAYS = 14;

export function sessionCookie(email: string) {
  return {
    name: SESSION_COOKIE,
    value: signToken("session", email, SESSION_DAYS * 86400),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  };
}

/** The signed-in reviewer's email, or null. */
export async function currentUser(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return verifyToken(token, "session");
  } catch {
    return null;
  }
}

export function appUrl(): string {
  const explicit = process.env.APP_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}

export function signInLink(email: string, ttlSeconds: number, next = "/"): string {
  const token = signToken("link", email, ttlSeconds);
  return `${appUrl()}/auth/verify?token=${encodeURIComponent(token)}&next=${encodeURIComponent(safeNext(next))}`;
}

/**
 * Uses a sign-in link: true the first time, false if it was already used. The used id is
 * stored as a hash, with the link's expiry, under auth/used-links/.
 */
export async function linkUsed(nonce: string): Promise<boolean> {
  return (await readJson(`auth/used-links/${storageHash(nonce)}.json`)) !== null;
}

export async function consumeLink(nonce: string, exp: number): Promise<boolean> {
  return createJson(`auth/used-links/${storageHash(nonce)}.json`, { exp, usedAt: new Date().toISOString() });
}
