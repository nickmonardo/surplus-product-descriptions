import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail, signInLink } from "@/lib/auth";
import { sendMail, signInMail } from "@/lib/mail";

export const dynamic = "force-dynamic";

/**
 * Emails a 15-minute sign-in link to an allowed address. The response is the same for
 * every address, so the page never reveals who is on the allowlist.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const email = String(form?.get("email") ?? "").trim().toLowerCase();
  const next = String(form?.get("next") ?? "/");
  if (email && isAllowedEmail(email)) {
    try {
      await sendMail(signInMail(email, signInLink(email, 15 * 60, next)));
    } catch (error) {
      console.error("[auth] could not send sign-in link", error instanceof Error ? error.message : error);
    }
  }
  return NextResponse.redirect(new URL("/login?sent=1", req.url), { status: 303 });
}
