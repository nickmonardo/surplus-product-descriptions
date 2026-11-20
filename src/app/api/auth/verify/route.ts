import { NextResponse, type NextRequest } from "next/server";
import { readToken, safeNext, sessionCookie, consumeLink } from "@/lib/auth";
import { sameOrigin } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

/** Continue on the sign-in page: uses the link (once) and starts a 14-day session. */
export async function POST(req: NextRequest) {
  const expired = NextResponse.redirect(new URL("/login?expired=1", req.url), { status: 303 });
  if (!sameOrigin(req)) return expired;
  const form = await req.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");
  const next = safeNext(form?.get("next"));
  let link: ReturnType<typeof readToken> = null;
  try {
    link = readToken(token, "link");
  } catch {
    link = null;
  }
  if (!link?.nonce || !(await consumeLink(link.nonce, link.exp))) return expired;
  const res = NextResponse.redirect(new URL(next, req.url), { status: 303 });
  res.cookies.set(sessionCookie(link.email));
  res.headers.set("Cache-Control", "no-store");
  return res;
}
