import Link from "next/link";
import { getAllTenders } from "@/lib/tenders";
import { requireUser } from "@/lib/auth/dal";
import { getMilestoneCatalog } from "@/lib/milestones";
import { computeDeadlines, computeStalled, formatDateID, todayISO } from "@/lib/tender-logic";
import { overallWinRate, totalPipelineValue } from "@/lib/analytics";
import { Icon } from "@/components/Icon";
import { MoneyValue } from "@/components/MoneyValue";
import { MilestoneDue, OperationsHeading } from "@/components/TenderOperations";
import type { Track } from "@/lib/types";
import styles from "./Overview.module.css";

export const dynamic = "force-dynamic";

export default async function Overview({ searchParams }: {
  searchParams: Promise<{ track?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const track: Track | "all" =
    params.track === "upstream" || params.track === "downstream" ? params.track : "all";
  const [tenders, catalog] = await Promise.all([
    getAllTenders({ track }),
    getMilestoneCatalog(),
  ]);
  const today = todayISO();
  const deadlines = computeDeadlines(tenders, today, catalog);
  const followups = computeStalled(tenders, today, catalog);
  const active = tenders.filter((tender) => !tender.result);
  const rate = overallWinRate(tenders);
  const known = active.filter((tender) => tender.oe !== null).length;
  const queueHref = (view: string) =>
    `/notifications?${new URLSearchParams({ view, ...(track === "all" ? {} : { track }) })}`;
  const overviewHref = track === "all" ? "/" : `/?track=${track}`;
  const tenderHref = (id: string) => `/tenders/${id}?${new URLSearchParams({ returnTo: overviewHref })}`;
  const analyticsHref = track === "all" ? "/analytics" : `/analytics?track=${track}`;

  return (
    <div className={styles.page}>
      <OperationsHeading
        title="Overview"
        context={<time dateTime={today}>{formatDateID(today)} · WIB</time>}
        actions={<Link className="button button-secondary" href={`/tenders?track=${track}`}>Open tenders <Icon name="arrow" width={14} height={14} /></Link>}
      />
      <nav className={styles.scope} aria-label="Overview track">
        {([["all", "All tracks"], ["upstream", "Upstream"], ["downstream", "Downstream"]] as const).map(([value, label]) => (
          <Link key={value} href={value === "all" ? "/" : `/?track=${value}`} aria-current={track === value ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>

      <div className={styles.board}>
        <section className={styles.queue} aria-labelledby="deadlines">
          <header className={styles.sectionHead}>
            <div><h2 id="deadlines">Upcoming deadlines</h2><p>{deadlines.length} tenders · Next 14 days</p></div>
            <Link href={queueHref("all")}>All deadlines <Icon name="arrow" width={14} height={14} /></Link>
          </header>
          {deadlines.length > 0 ? (
            <>
              <div className={styles.columnLabels} aria-hidden="true"><span>Package</span><span>Milestone / due</span></div>
              <ul className={styles.list}>
                {deadlines.slice(0, 6).map((item, index) => (
                  <li key={item.tenderId} className={index === 0 ? styles.first : undefined}>
                    <Link className={styles.dueRow} href={tenderHref(item.tenderId)}>
                      <span className={styles.identity}>
                        <strong>{item.product === "—" ? item.customer : item.product}</strong>
                        <small>{item.customer}</small>
                      </span>
                      <MilestoneDue label={item.milestoneLabel} date={item.dateIso} days={item.days} />
                      <span className={styles.arrow} aria-hidden="true">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : <p className={styles.empty}>No milestones due in the next 14 days.</p>}
        </section>

        <section className={styles.queue} aria-labelledby="followups">
          <header className={styles.sectionHead}>
            <div><h2 id="followups">Follow-up queue</h2><p>{followups.length} active tenders without a next date</p></div>
            <Link href={queueHref("followup")}>View queue <Icon name="arrow" width={14} height={14} /></Link>
          </header>
          {followups.length > 0 ? (
            <ul className={styles.list}>
              {followups.slice(0, 4).map((item) => (
                <li key={item.tenderId}>
                  <Link className={styles.followRow} href={tenderHref(item.tenderId)}>
                    <span className={styles.identity}>
                      <strong>{item.product === "—" ? item.customer : item.product}</strong>
                      <small>{item.customer}</small>
                      <small>{item.lastMilestoneLabel && item.lastMilestoneDateFormatted ? `Last: ${item.lastMilestoneLabel} · ${item.lastMilestoneDateFormatted}` : "No milestone recorded"}</small>
                    </span>
                    <span className={styles.arrow} aria-hidden="true">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className={styles.empty}>No tenders in the follow-up queue.</p>}
        </section>
      </div>

      <section className={styles.summary} aria-labelledby="pipeline">
        <h2 id="pipeline">Pipeline context</h2>
        <dl>
          <div><dt>Active tenders</dt><dd>{active.length}</dd></div>
          <div><dt>Known pipeline · {known} tenders with OE</dt><dd><MoneyValue value={known ? totalPipelineValue(tenders) : null} canView /></dd></div>
          <div><dt>Win rate · {rate.decided} decided</dt><dd>{rate.pct === null ? "—" : `${rate.pct}%`}</dd></div>
        </dl>
        <Link href={analyticsHref}>Analytics <Icon name="arrow" width={14} height={14} /></Link>
      </section>
    </div>
  );
}
