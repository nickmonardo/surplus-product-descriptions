import Link from "next/link";

/** TIA top bar: TIA wordmark left, the client's logo and the signed-in reviewer right. */
export function TopBar({ user, active }: { user?: string; active?: "descriptions" | "magento" }) {
  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="Product descriptions home">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name">The Influence Agency</span>
        <span className="brand-product">Product descriptions</span>
      </Link>
      {user ? (
        <nav className="topnav" aria-label="Sections">
          <Link href="/" aria-current={active === "descriptions" ? "page" : undefined}>
            Descriptions
          </Link>
          <Link href="/magento" aria-current={active === "magento" ? "page" : undefined}>
            Magento to-do
          </Link>
        </nav>
      ) : null}
      <div className="topbar-right">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="client-logo" src="/surplus-logo.jpg" alt="Surplus Furniture & Mattress Warehouse" width={512} height={128} />
        {user ? (
          <div className="who">
            <span className="who-email">{user}</span>
            <form action="/api/auth/logout" method="post">
              <button className="linkbtn" type="submit">
                Sign out
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </header>
  );
}
