import Link from "next/link";
import type { ReactNode } from "react";
import { OperationsHeading } from "@/components/TenderOperations";
import { AnalyticsFilters } from "@/components/AnalyticsFilters";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { getAllTenders, getFilterOptions } from "@/lib/tenders";
import {
  ascendingPeriods,
  formatCompactRupiah,
  lossReasonByPeriod,
  outcomesByPeriod,
  overallWinRate,
  pipelineValueByGroup,
  statusBreakdown,
  totalPipelineValue,
  totalWinValue,
  trackComparison,
  winRateByGroup,
} from "@/lib/analytics";
import { formatRupiah } from "@/lib/tender-logic";
import s from "./Analytics.module.css";

export const dynamic = "force-dynamic";

function Report({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: ReactNode;
}) {
  return (
    <section className={s.report}>
      <header>
        <h2>{title}</h2>
        <p>{caption}</p>
      </header>
      {children}
    </section>
  );
}

function RankedBars({
  rows,
  money = false,
}: {
  rows: { label: string; value: number; detail?: string }[];
  money?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return rows.length ? (
    <ol className={s.ranks}>
      {rows.map((r) => (
        <li key={r.label}>
          <div>
            <span>{r.label}</span>
            <b title={money ? formatRupiah(r.value) : undefined}>
              {money ? formatCompactRupiah(r.value) : r.value}
            </b>
          </div>
          <div className={s.bar} aria-hidden="true">
            <i style={{ width: `${(100 * r.value) / max}%` }} />
          </div>
          {r.detail && <small>{r.detail}</small>}
        </li>
      ))}
    </ol>
  ) : (
    <p className={s.empty}>No recorded values for this selection.</p>
  );
}

export default async function Analytics({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireUser();
  const params = await searchParams;
  const track =
    params.track === "upstream" || params.track === "downstream"
      ? params.track
      : "all";
  const all = await getAllTenders({ track });
  const options = getFilterOptions(all);
  const scope = (value: string | undefined, allowed: string[]) =>
    value && allowed.includes(value) ? value : "all";
  const area = scope(params.area, options.areas);
  const period = scope(params.period, options.periods);
  const customer = scope(params.customer, options.customers);
  const data = all.filter(
    (t) =>
      (area === "all" || t.area === area) &&
      (period === "all" || t.period === period) &&
      (customer === "all" || t.customer === customer),
  );
  const query = new URLSearchParams({ track, area, period, customer });
  const segments = params.report === "segments";
  const periods = ascendingPeriods(data.map((t) => t.period));
  const coverage =
    periods.length > 1
      ? `${periods[0]}–${periods.at(-1)}`
      : periods[0] || "No periods";
  const outcome = overallWinRate(data);
  const active = data.filter((t) => !t.result);
  const won = data.filter((t) => t.result === "WIN");
  const knownBids = won.filter((t) => t.nilaiPenawaran !== null).length;
  const estimated = active.filter((t) => t.oe !== null);
  const rows = outcomesByPeriod(data, periods);
  const totals = new Map<string, number>();
  for (const t of data) totals.set(t.period, (totals.get(t.period) ?? 0) + 1);
  const maxVolume = Math.max(1, ...totals.values());
  const bids = new Map<string, number>();
  for (const t of data)
    if (t.customer && t.nilaiPenawaran != null)
      bids.set(t.customer, (bids.get(t.customer) ?? 0) + t.nilaiPenawaran);
  const customers = [...bids]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label, value }));
  return (
    <div className={s.page}>
      <OperationsHeading
        title="Tender analytics"
        context={`${data.length} tenders · ${coverage} · ${track === "all" ? "Both tracks" : track}`}
        actions={
          <Button asChild variant="outline">
            <a href={`/tenders/export?${query}`}>Export this scope</a>
          </Button>
        }
      />
      <AnalyticsFilters
        {...{ area, period, customer, track }}
        areas={options.areas}
        periods={options.periods}
        customers={options.customers}
        report={segments ? "segments" : undefined}
      />
      <nav className={s.tabs} aria-label="Analytics reports">
        {[
          ["performance", "Performance"],
          ["segments", "Segment comparisons"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={`/analytics?${query}&report=${key}`}
            aria-current={
              (segments ? "segments" : "performance") === key
                ? "page"
                : undefined
            }
          >
            {label}
          </Link>
        ))}
      </nav>
      {!segments ? (
        <>
          <div className={s.score}>
            <div className={s.lead}>
              <span>Win rate</span>
              <strong>{outcome.pct === null ? "—" : outcome.pct + "%"}</strong>
              <small>
                {outcome.win} wins / {outcome.decided} decided tenders
              </small>
            </div>
            <div>
              <span>Won bid value</span>
              <strong>
                {won.length && !knownBids
                  ? "—"
                  : formatCompactRupiah(totalWinValue(data))}
              </strong>
              <small>
                {knownBids} of {won.length} wins with a bid value
              </small>
            </div>
            <div>
              <span>Active pipeline · OE</span>
              <strong>
                {active.length && !estimated.length
                  ? "—"
                  : formatCompactRupiah(totalPipelineValue(data))}
              </strong>
              <small>
                {estimated.length} of {active.length} open packages with an
                estimate
              </small>
            </div>
          </div>
          <div className={s.grid}>
            <Report
              title="Tender volume by period"
              caption="Number of packages per period, grouped by outcome"
            >
              <div className={s.legend}>
                {["Won", "Lost", "Other closed", "Active"].map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              {rows.length ? (
                <div
                  className={s.plotScroll}
                  role="region"
                  aria-label="Tender volume chart"
                  tabIndex={0}
                >
                  <div className={s.plot}>
                    {rows.map((r) => {
                      const total = totals.get(r.period) ?? 0;
                      const active = total - r.win - r.loss - r.other;
                      const description = `${r.period}: ${total} packages, ${r.win} won, ${r.loss} lost, ${r.other} other closed, ${active} active`;
                      return (
                        <figure
                          key={r.period}
                          aria-label={description}
                          title={description}
                        >
                          <div className={s.columnTrack}>
                            <strong>{total}</strong>
                            <div
                              className={s.column}
                              style={{ height: `${(total / maxVolume) * 80}%` }}
                            >
                              {[r.win, r.loss, r.other, active].map((n, i) => (
                                <i key={i} style={{ flexGrow: n }} />
                              ))}
                            </div>
                          </div>
                          <figcaption>{r.period}</figcaption>
                        </figure>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className={s.empty}>No tenders match these filters.</p>
              )}
            </Report>
            <Report
              title="Bid value by customer"
              caption="Top 6 · sum of recorded bids across all outcomes"
            >
              <RankedBars money rows={customers} />
            </Report>
          </div>
          <Report
            title="Tender status"
            caption="Package count across the selected scope"
          >
            <div className={s.status}>
              {statusBreakdown(data).map((row) => (
                <div key={row.key}>
                  <span>{row.label}</span>
                  <strong>{row.count}</strong>
                </div>
              ))}
            </div>
          </Report>
        </>
      ) : (
        <div className={s.grid}>
          <Report
            title="Track comparison"
            caption="Tender count, win rate and known monetary values"
          >
            <RankedBars
              rows={trackComparison(data).map((r) => ({
                label: r.label,
                value: r.count,
                detail: `${r.winRate === null ? "—" : r.winRate + "%"} win rate · Pipeline ${formatCompactRupiah(r.pipelineValue)} · Won ${formatCompactRupiah(r.winValue)}`,
              }))}
            />
          </Report>
          <Report
            title="Active pipeline by area"
            caption="Top 8 areas · recorded OE on open packages"
          >
            <RankedBars
              money
              rows={pipelineValueByGroup(estimated, (t) => t.area)
                .slice(0, 8)
                .map((r) => ({ label: r.group, value: r.value }))}
            />
          </Report>
          {(["customer", "area", "entitas"] as const).map((key) => {
            const groups = winRateByGroup(data, (t) => t[key]);
            return (
              <Report
                key={key}
                title={`Win rate by ${key === "entitas" ? "entity" : key}`}
                caption="Top 8 by decisions · minimum 3 decided tenders"
              >
                <div className={s.comparisons}>
                  {groups.map((r) => (
                    <div key={r.group}>
                      <b>{r.group}</b>
                      <span>
                        {r.winRatePct}% · {r.win} wins / {r.decided} decisions
                      </span>
                    </div>
                  ))}
                  {!groups.length && (
                    <small>Insufficient decided tenders.</small>
                  )}
                </div>
              </Report>
            );
          })}
          <Report
            title="Loss reasons by period"
            caption="Share of recorded losses within each period"
          >
            <div className={s.comparisons}>
              {lossReasonByPeriod(data, periods).map((r) => (
                <div key={r.period}>
                  <b>
                    {r.period} · {r.totalLoss} lost
                  </b>
                  {r.shares
                    .filter((x) => x.count)
                    .map((x) => (
                      <small key={x.label}>
                        {x.label} · {x.count} ({x.pct}%)
                      </small>
                    ))}
                </div>
              ))}
              {!outcome.loss && <small>No recorded losses.</small>}
            </div>
          </Report>
        </div>
      )}
    </div>
  );
}
