import Link from "next/link";

export function TopBar({ user, crumb }: { user: string; crumb?: string }) {
  return (
    <div className="topbar">
      <div className="eyebrow">
        <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
          Surplus Furniture · Product descriptions
        </Link>
        {crumb ? ` · ${crumb}` : ""}
      </div>
      <div className="who">
        <span>{user}</span>
        <form action="/api/auth/logout" method="post">
          <button className="linkbtn" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
