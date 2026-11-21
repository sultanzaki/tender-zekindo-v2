import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

import { Card } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { OperationsHeading } from "@/components/TenderOperations";
import { requireUser } from "@/lib/auth/dal";
import { MoneyValue, MoneyAccessNotice } from "@/components/MoneyValue";
import styles from "@/components/Workspace.module.css";
import { getAllTenders, getFilterOptions } from "@/lib/tenders";
import {
  ascendingPeriods,
  outcomesByPeriod,
  lossReasonByPeriod,
  winRateByGroup,
  pipelineValueByGroup,
  overallWinRate,
  totalPipelineValue,
  totalWinValue,
  runningCount,
  statusBreakdown,
  trackComparison,
} from "@/lib/analytics";
import { KpiCards } from "@/components/charts/KpiCards";
import { WinRateTrendChart } from "@/components/charts/WinRateTrendChart";
import { OutcomeVolumeChart } from "@/components/charts/OutcomeVolumeChart";
import { LossReasonTrendChart } from "@/components/charts/LossReasonTrendChart";
import { GroupWinRateChart } from "@/components/charts/GroupWinRateChart";
import { PipelineValueChart } from "@/components/charts/PipelineValueChart";
import { TenderStatusDonut } from "@/components/charts/TenderStatusDonut";
import { TrackComparisonChart } from "@/components/charts/TrackComparisonChart";
import { AnalyticsFilters } from "@/components/AnalyticsFilters";
import { TRACK_LABELS, type Track } from "@/lib/types";
import shared from "@/components/shared.module.css";
import chartStyles from "@/components/charts/charts.module.css";

export const dynamic = "force-dynamic";

/** All metrics require a validated session. Filters live in the URL. */
export default async function AnalyticsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    area?: string;
    period?: string;
    track?: string;
    customer?: string;
  }>;
}) {
  const ctx = await requireUser();
  const params = await searchParams;
  // The default here differs from the tender list on purpose: this is an
  // overview, so it starts on BOTH tracks and you narrow it yourself. A stale
  // bookmark naming a track we do not recognise falls back to both rather than
  // to an empty dashboard.
  const track: Track | "all" =
    params.track === "upstream" || params.track === "downstream"
      ? params.track
      : "all";

  // Scoped to the chosen track first: the area/period options offered, and the
  // "X of Y" denominator, must describe the track you are actually looking at.
  const allTenders = await getAllTenders({ track });
  const canViewMoney = !!ctx;
  const options = getFilterOptions(allTenders);

  // A value that no longer exists is treated as "no filter" rather than as an
  // empty result: a stale bookmark for a renamed area should show the data, not
  // look like an empty database.
  const area =
    params.area && options.areas.includes(params.area) ? params.area : "all";
  const period =
    params.period && options.periods.includes(params.period)
      ? params.period
      : "all";

  const customer =
    params.customer && options.customers.includes(params.customer)
      ? params.customer
      : "all";
  const exportParams = new URLSearchParams({ track, area, period, customer });
  const tenders = allTenders.filter(
    (t) =>
      (area === "all" || t.area === area) &&
      (period === "all" || t.period === period) &&
      (customer === "all" || t.customer === customer),
  );

  // Every figure below — KPI cards and charts alike — comes from the filtered
  // set. That includes the trend charts: with one period selected a "trend" is a
  // single bar, which is the honest answer to "show me only this one".
  const periods = ascendingPeriods(tenders.map((t) => t.period));
  const outcomeRows = outcomesByPeriod(tenders, periods);
  const lossRows = lossReasonByPeriod(tenders, periods);
  const winRateByArea = winRateByGroup(tenders, (t) => t.area);
  const winRateByEntitas = winRateByGroup(tenders, (t) => t.entitas);
  const pipelineByArea = canViewMoney
    ? pipelineValueByGroup(tenders, (t) => t.area)
    : [];
  const statusData = statusBreakdown(tenders);
  const trackData = trackComparison(tenders);

  const overall = overallWinRate(tenders);
  const kpiData = {
    pipelineValue: totalPipelineValue(tenders),

    winValue: totalWinValue(tenders),
    runningCount: runningCount(tenders),
    winRatePct: overall.pct,
    winCount: overall.win,
    lossCount: overall.loss,
    decidedCount: overall.decided,
  };

  const activeFilters = [
    track === "all" ? null : `Track: ${TRACK_LABELS[track]}`,
    area === "all" ? null : `Area: ${area}`,
    period === "all" ? null : `Period: ${period}`,
    customer === "all" ? null : `Customer: ${customer}`,
  ].filter((v): v is string => !!v);

  const coverage =
    periods.length > 1
      ? `${periods[0]}–${periods.at(-1)}`
      : (periods[0] ?? "No periods");
  return (
    <div className={styles.page}>
      <OperationsHeading
        title="Tender analytics"
        actions={
          <Button asChild variant="outline">
            <a href={`/tenders/export?${exportParams}`}>Export this scope</a>
          </Button>
        }
        context={[`${tenders.length} tenders`, coverage, ...activeFilters].join(
          " · ",
        )}
      />
      <AnalyticsFilters
        areas={options.areas}
        periods={options.periods}
        customers={options.customers}
        customer={customer}
        area={area}
        period={period}
        track={track}
      />

      {!canViewMoney && (
        <MoneyAccessNotice returnTo={`/analytics?${exportParams}`} />
      )}

      {
        <div className={chartStyles.grid2} style={{ marginBottom: 20 }}>
          <Card
            className={`${shared.card} gap-0 py-0`}
            style={{ overflow: "hidden" }}
          >
            <div className={shared.cardHeader}>
              <h2 className={shared.cardTitle}>Win Rate Trend</h2>
              <span className={shared.cardMeta}>
                By period, decided tenders only
              </span>
            </div>
            <WinRateTrendChart data={outcomeRows} />
          </Card>

          <Card
            className={`${shared.card} gap-0 py-0`}
            style={{ overflow: "hidden" }}
          >
            <div className={shared.cardHeader}>
              <h2 className={shared.cardTitle}>Outcome Volume</h2>
              <span className={shared.cardMeta}>
                Tender count by outcome, per period
              </span>
            </div>
            <OutcomeVolumeChart data={outcomeRows} />
          </Card>
        </div>
      }

      <KpiCards data={kpiData} canViewMoney={canViewMoney} />
      <div className={styles.note}>
        Win rate = WIN ÷ (WIN + LOSS). Canceled, withdrawn, retender, and
        no-info outcomes are excluded. Pipeline = known OE of active tenders
        only.{" "}
        {canViewMoney && (
          <>
            {tenders.filter((t) => !t.result && t.oe === null).length} active
            tenders have no OE;{" "}
            {
              tenders.filter(
                (t) => t.result === "WIN" && t.nilaiPenawaran === null,
              ).length
            }{" "}
            won tenders have no recorded bid value.
          </>
        )}
      </div>

      <Card
        className={shared.card}
        style={{ marginBottom: 20, overflow: "hidden" }}
      >
        <div className={shared.cardHeader}>
          <h2 className={shared.cardTitle}>Loss Reason Mix</h2>
          <span className={shared.cardMeta}>
            Share of losses by reason, per period
          </span>
        </div>
        <LossReasonTrendChart data={lossRows} />
      </Card>

      <div className={chartStyles.grid2} style={{ marginBottom: 20 }}>
        <Card
          className={`${shared.card} gap-0 py-0`}
          style={{ overflow: "hidden" }}
        >
          <div className={shared.cardHeader}>
            <h2 className={shared.cardTitle}>Tender Status</h2>
            <span className={shared.cardMeta}>
              Breakdown of all tenders by outcome
            </span>
          </div>
          <TenderStatusDonut data={statusData} />
        </Card>

        <Card
          className={`${shared.card} gap-0 py-0`}
          style={{ overflow: "hidden" }}
        >
          <div className={shared.cardHeader}>
            <h2 className={shared.cardTitle}>Track Comparison</h2>
            <span className={shared.cardMeta}>Upstream vs downstream</span>
          </div>
          <TrackComparisonChart data={trackData} canViewMoney={canViewMoney} />
        </Card>
      </div>

      <div className={chartStyles.grid2} style={{ marginBottom: 20 }}>
        <Card
          className={`${shared.card} gap-0 py-0`}
          style={{ overflow: "hidden" }}
        >
          <div className={shared.cardHeader}>
            <h2 className={shared.cardTitle}>Win Rate by Area</h2>
            <span className={shared.cardMeta}>
              Areas with at least 3 decided tenders
            </span>
          </div>
          <GroupWinRateChart
            data={winRateByArea}
            emptyMessage="Not enough decided tenders per area yet."
          />
        </Card>

        <Card
          className={`${shared.card} gap-0 py-0`}
          style={{ overflow: "hidden" }}
        >
          <div className={shared.cardHeader}>
            <h2 className={shared.cardTitle}>Win Rate by Entity</h2>
            <span className={shared.cardMeta}>
              Entities with at least 3 decided tenders
            </span>
          </div>
          <GroupWinRateChart
            data={winRateByEntitas}
            emptyMessage="Not enough decided tenders per entity yet."
          />
        </Card>
      </div>

      {
        <Card
          className={`${shared.card} gap-0 py-0`}
          style={{ overflow: "hidden" }}
        >
          <div className={shared.cardHeader}>
            <h2 className={shared.cardTitle}>Pipeline Value by Area</h2>
            <span className={shared.cardMeta}>
              OE of currently running tenders, top 8 areas
            </span>
          </div>
          {canViewMoney ? (
            <PipelineValueChart
              data={pipelineByArea}
              emptyMessage="No running tenders with an OE value yet."
            />
          ) : (
            <div style={{ padding: "48px 20px", textAlign: "center" }}>
              <MoneyValue canView={false} />
            </div>
          )}
        </Card>
      }
      <Card className={shared.card} style={{ marginBottom: 24 }}>
        <div className={shared.cardHeader}>
          <h2 className={shared.cardTitle}>Customer performance</h2>
          <span className={shared.cardMeta}>
            Win rate · At least 3 decided tenders per customer
          </span>
        </div>
        <GroupWinRateChart
          data={winRateByGroup(tenders, (t) => t.customer)}
          emptyMessage="Not enough decided tenders per customer yet."
        />
      </Card>
      <Collapsible className={shared.card}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="m-2">
            View underlying outcome data
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className={styles.tableWrap}>
            <Table className={styles.table}>
              <caption>Exact counts for the selected scope</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Won</TableHead>
                  <TableHead>Lost</TableHead>
                  <TableHead>Other outcomes</TableHead>
                  <TableHead>Decided</TableHead>
                  <TableHead>Win rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outcomeRows.map((row) => (
                  <TableRow key={row.period}>
                    <TableCell>{row.period}</TableCell>
                    <TableCell>{row.win}</TableCell>
                    <TableCell>{row.loss}</TableCell>
                    <TableCell>{row.other}</TableCell>
                    <TableCell>{row.decided}</TableCell>
                    <TableCell>
                      {row.winRatePct === null ? "—" : `${row.winRatePct}%`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
