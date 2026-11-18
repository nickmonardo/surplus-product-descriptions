import { NextResponse, type NextRequest } from "next/server";
import { sessionCookie, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** The emailed link lands here: a valid link starts a 14-day session. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const nextParam = req.nextUrl.searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
  let email: string | null = null;
  try {
    email = verifyToken(token, "link");
  } catch {
    email = null;
  }
  if (!email) return NextResponse.redirect(new URL("/login?expired=1", req.url), { status: 303 });
  const res = NextResponse.redirect(new URL(next, req.url), { status: 303 });
  res.cookies.set(sessionCookie(email));
  res.headers.set("Cache-Control", "no-store");
  return res;
}
