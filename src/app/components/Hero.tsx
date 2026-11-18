import type { ReactNode } from "react";

/** TIA gradient banner: micro label, uppercase title with an accent word, frosted stat pills. */
export function Hero({
  micro,
  title,
  accent,
  intro,
  stats = [],
}: {
  micro: string;
  title: string;
  accent?: string;
  intro?: ReactNode;
  stats?: { value: number | string; label: string }[];
}) {
  return (
    <section className="hero">
      <div className="hero-inner">
        <p className="hero-micro">✦ {micro}</p>
        <h1>
          {title}
          {accent ? (
            <>
              {" "}
              <em>{accent}</em>
            </>
          ) : null}
        </h1>
        {intro ? <p className="hero-intro">{intro}</p> : null}
        {stats.length ? (
          <div className="hero-pills">
            {stats.map((s) => (
              <div className="hero-pill" key={s.label}>
                <strong>{s.value}</strong> {s.label}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
