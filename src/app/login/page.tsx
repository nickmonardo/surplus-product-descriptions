import { redirect } from "next/navigation";
import { currentUser, safeNext } from "@/lib/auth";
import { TopBar } from "../components/TopBar";
import { Footer } from "../components/Footer";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (await currentUser()) redirect("/");
  const params = await searchParams;
  const next = safeNext(params.next);
  return (
    <>
      <TopBar />
      <main className="page">
        <form className="login" method="post" action="/api/auth/request">
          <p className="hero-micro dark">Surplus Furniture · Product descriptions</p>
          <h1>Sign in</h1>
          {params.sent ? (
            <p className="flash" role="status">
              If that address can review, a sign-in link is on its way. It works once, for 15 minutes. Asked twice? Use the first email: a new link can be sent every 2 minutes.
            </p>
          ) : null}
          {params.expired ? (
            <p className="flash warn" role="alert">
              That link has expired, was already used, or isn&apos;t valid. Enter your email for a new one.
            </p>
          ) : null}
          <label htmlFor="email">Work email</label>
          <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
          <input type="hidden" name="next" value={next} />
          <button className="btn primary" type="submit">
            Email me a sign-in link
          </button>
          <p className="muted">No password needed. We email you a link that signs you in on this device for 14 days.</p>
        </form>
      </main>
      <Footer />
    </>
  );
}
