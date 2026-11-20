import type { NextRequest } from "next/server";

/**
 * True for requests sent by this site's own pages. Browsers send Origin on every POST, but
 * as "null" from a page with a no-referrer policy (the sign-in page); then, or when Origin is
 * missing, Sec-Fetch-Site must say same-origin. (The session cookie is also SameSite=Lax, so
 * a cross-site POST arrives signed out anyway.)
 */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (origin && origin !== "null") return origin === req.nextUrl.origin;
  return req.headers.get("sec-fetch-site") === "same-origin";
}

/** True when the body is declared as JSON (blocks text/plain form posts dressed up as JSON). */
export function isJson(req: NextRequest): boolean {
  return (req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json");
}
