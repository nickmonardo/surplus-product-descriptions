import "server-only";
import { cookies } from "next/headers";
import { isAllowedEmail, isStaff, signToken, verifyToken } from "./tokens";

// Email sign-in without a database: links and sessions are HMAC-signed tokens
// (AUTH_SECRET), so nothing is stored. Allowed: any address at ALLOWED_DOMAINS
// (default theinfluenceagency.com) plus each address in REVIEWER_EMAILS (Surplus reviewers).
// A link works until it expires (15 minutes from the sign-in page, 3 days in the weekly
// email); it is not single-use, because there is nowhere to record that it was used.

export { isAllowedEmail, isStaff, signToken, verifyToken };

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
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return `${appUrl()}/auth/verify?token=${encodeURIComponent(token)}&next=${encodeURIComponent(safeNext)}`;
}
