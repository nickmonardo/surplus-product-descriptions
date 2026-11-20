import type { Metadata } from "next";
import { linkUsed, readToken, safeNext } from "@/lib/auth";
import { TopBar } from "../../components/TopBar";
import { Footer } from "../../components/Footer";

export const dynamic = "force-dynamic";
// The URL carries the sign-in token: never send it on as a referrer, never index it.
export const metadata: Metadata = { referrer: "no-referrer", robots: { index: false, follow: false } };

/**
 * The emailed link lands here. Opening it changes nothing: pressing Continue (a POST to
 * /api/auth/verify) uses the link and starts the session, so a mail scanner that opens
 * links can't use it up or sign itself in.
 */
export default async function Verify({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const next = safeNext(params.next);
  let email: string | null = null;
  try {
    const link = readToken(token, "link");
    email = link?.nonce && !(await linkUsed(link.nonce)) ? link.email : null;
  } catch {
    email = null;
  }
  return (
    <>
      <TopBar />
      <main className="page">
        {email ? (
          <form className="login" method="post" action="/api/auth/verify">
            <p className="hero-micro dark">Surplus Furniture · Product descriptions</p>
            <h1>Continue signing in</h1>
            <p>
              Signing in as <b>{email}</b>.
            </p>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="next" value={next} />
            <button className="btn primary" type="submit">
              Continue
            </button>
            <p className="muted">Each sign-in link works once. You&apos;ll stay signed in on this device for 14 days.</p>
          </form>
        ) : (
          <div className="login">
            <h1>Link expired</h1>
            <p className="flash warn" role="alert">
              That sign-in link has expired, was already used, or isn&apos;t valid.
            </p>
            <a className="btn primary" href="/login">
              Get a new link
            </a>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
