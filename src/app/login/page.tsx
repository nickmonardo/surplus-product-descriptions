import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (await currentUser()) redirect("/");
  const params = await searchParams;
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/";
  return (
    <form className="login" method="post" action="/api/auth/request">
      <div className="eyebrow">Surplus Furniture · Product descriptions</div>
      <h1 style={{ fontSize: 24 }}>Sign in</h1>
      {params.sent ? (
        <p className="flash" role="status">
          If that address can review, a sign-in link is on its way. It works for 15 minutes.
        </p>
      ) : null}
      {params.expired ? (
        <p className="flash warn" role="alert">
          That link has expired or isn&apos;t valid. Enter your email for a new one.
        </p>
      ) : null}
      <label htmlFor="email" style={{ fontWeight: 600, fontSize: 14 }}>
        Work email
      </label>
      <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
      <input type="hidden" name="next" value={next} />
      <button className="btn primary" type="submit">
        Email me a sign-in link
      </button>
      <p className="muted" style={{ fontSize: 13 }}>
        No password needed. We email you a link that signs you in on this device for 14 days.
      </p>
    </form>
  );
}
