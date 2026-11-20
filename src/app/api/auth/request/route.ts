import { after, NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail, safeNext, signInLink } from "@/lib/auth";
import { sendMail, signInMail } from "@/lib/mail";
import { sameOrigin } from "@/lib/request-guard";
import { readJson, writeJson } from "@/lib/storage";
import { storageHash } from "@/lib/tokens";

export const dynamic = "force-dynamic";

/** At most one sign-in email per address in this window, so the form can't be used to flood an inbox. */
const THROTTLE_MS = 2 * 60 * 1000;

async function sendLink(email: string, next: string) {
  try {
    const key = `auth/throttle/${storageHash(email)}.json`;
    const last = await readJson<{ at: number }>(key);
    if (last && Date.now() - last.at < THROTTLE_MS) return;
    await writeJson(key, { at: Date.now() });
    await sendMail(signInMail(email, signInLink(email, 15 * 60, next)));
  } catch (error) {
    console.error("[auth] could not send sign-in link", error instanceof Error ? error.message : error);
  }
}

/**
 * Emails a 15-minute, single-use sign-in link to an allowed address. The response is the
 * same, and returns as fast, for every address: the email goes out after the response, so
 * neither the page nor its timing reveals who is on the allowlist.
 */
export async function POST(req: NextRequest) {
  const done = NextResponse.redirect(new URL("/login?sent=1", req.url), { status: 303 });
  if (!sameOrigin(req)) return done;
  const form = await req.formData().catch(() => null);
  const email = String(form?.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const next = safeNext(form?.get("next"));
  if (email && isAllowedEmail(email)) after(() => sendLink(email, next));
  return done;
}
