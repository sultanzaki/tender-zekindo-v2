import { PeriodPerformance } from "@/components/PeriodPerformance";
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
  overallWinRate,
  pipelineValueByGroup,
  statusBreakdown,
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
  const active = all.filter(
    (t) =>
      !t.result &&
      (area === "all" || t.area === area) &&
      (customer === "all" || t.customer === customer),
  );
  const activeBids = active.filter((t) => t.nilaiPenawaran !== null);
  const won = data.filter((t) => t.result === "WIN");
  const knownBids = won.filter((t) => t.nilaiPenawaran !== null).length;
  const estimated = active.filter((t) => t.oe !== null);
  const bids = new Map<string, number>();
  for (const t of activeBids)
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
              <span>Current active bids</span>
              <strong>
                {active.length && !activeBids.length
                  ? "—"
                  : formatCompactRupiah(
                      activeBids.reduce(
                        (sum, t) => sum + (t.nilaiPenawaran ?? 0),
                        0,
                      ),
                    )}
              </strong>
              <small>
                {activeBids.length} of {active.length} active packages with a
                bid · all periods
              </small>
            </div>
          </div>
          <div className={s.grid}>
            <PeriodPerformance
              key={query.toString()}
              periods={periods}
              packages={data
                .filter(
                  (t) => t.result === "WIN" || t.result?.startsWith("LOSS"),
                )
                .map((t) => ({
                  id: t.id,
                  name: t.product || t.tenderNo || t.id,
                  customer: t.customer,
                  period: t.period,
                  won: t.result === "WIN",
                  bid: t.nilaiPenawaran,
                }))}
            />
            <Report
              title="Active bids by customer"
              caption="Current exposure · top 6 by recorded bid value across all periods"
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
            caption="Current exposure · top 8 by recorded OE across all periods"
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
