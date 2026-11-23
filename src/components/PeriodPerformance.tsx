"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCompactRupiah } from "@/lib/analytics";
import { formatRupiah } from "@/lib/tender-logic";
import styles from "@/app/analytics/Analytics.module.css";

type Package = {
  id: string;
  name: string;
  customer: string;
  period: string;
  won: boolean;
  bid: number | null;
};
const outcomes = ["Won", "Lost"] as const;
export function PeriodPerformance({
  packages,
  periods,
}: {
  packages: Package[];
  periods: string[];
}) {
  const [money, setMoney] = useState(false);
  const [selection, select] = useState<{ period: string; won: boolean } | null>(
    null,
  );
  const [limit, setLimit] = useState(12);
  const buckets = useMemo(() => {
    const map = new Map(
      periods.map((period) => [period, [[], []] as [Package[], Package[]]]),
    );
    for (const row of packages)
      map.get(row.period)?.[row.won ? 0 : 1].push(row);
    return map;
  }, [packages, periods]);
  const series = periods.map((period) => ({
    period,
    values: buckets
      .get(period)!
      .map((group) =>
        money
          ? group.length && group.every((p) => p.bid === null)
            ? null
            : group.reduce((sum, p) => sum + (p.bid ?? 0), 0)
          : group.length,
      ),
  }));
  const max = Math.max(
    1,
    ...series.flatMap((r) => r.values.map((v) => v ?? 0)),
  );
  const detail =
    selection && buckets.get(selection.period)?.[selection.won ? 0 : 1];
  return (
    <section className={styles.report}>
      <header>
        <h2>Results by tender period</h2>
        <p>Won and lost packages · select a bar to inspect the packages.</p>
      </header>
      <div className={styles.switcher}>
        {["Package count", "Recorded bid value"].map((label, i) => (
          <button
            type="button"
            key={label}
            aria-pressed={money === Boolean(i)}
            onClick={() => setMoney(Boolean(i))}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={styles.legend}>
        <span>Won</span>
        <span>Lost</span>
      </div>
      {packages.length ? (
        <div className={styles.plotScroll}>
          <div className={styles.plot} data-money={money}>
            {series.map((r) => (
              <figure key={r.period}>
                <div className={styles.pair}>
                  {r.values.map((v, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`${r.period}, ${outcomes[i]}, ${money ? formatRupiah(v) : v} · view packages`}
                      aria-pressed={
                        selection?.period === r.period && selection.won === !i
                      }
                      style={{
                        height: `calc(20px + ${((v ?? 0) / max) * 75}%)`,
                      }}
                      onClick={() => {
                        select({ period: r.period, won: !i });
                        setLimit(12);
                      }}
                    >
                      <small>
                        {v == null ? "—" : money ? formatCompactRupiah(v) : v}
                      </small>
                      <i />
                    </button>
                  ))}
                </div>
                <figcaption>{r.period}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : (
        <p>No decided packages for this period.</p>
      )}
      {detail && selection && (
        <div className={styles.drill}>
          <h3>
            {selection.won ? "Won" : "Lost"} packages · {selection.period} (
            {detail.length})
          </h3>
          {detail.slice(0, limit).map((p) => (
            <Link key={p.id} href={`/tenders/${p.id}`}>
              <span>
                {p.name}
                <small>{p.customer}</small>
              </span>
              <b>{formatRupiah(p.bid)}</b>
            </Link>
          ))}
          {detail.length > limit && (
            <button onClick={() => setLimit(limit + 12)}>
              Show more packages
            </button>
          )}
        </div>
      )}
    </section>
  );
}
