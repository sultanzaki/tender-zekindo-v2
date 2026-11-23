"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";

import { useState } from "react";
import Link from "next/link";
import type { DeadlineRow, StalledRow } from "@/lib/tender-logic";
import { deadlineCalendar } from "@/lib/calendar";
import { PageHeading } from "./PageHeading";
import { TrackBadge } from "./TrackBadge";
import styles from "./Workspace.module.css";
function windowLabel(days: number) {
  return days === 0 ? "Today" : days <= 3 ? "Next 1–3 days" : "Next 4–14 days";
}
const VIEWS = [
  ["all", "Scheduled"],
  ["today", "Today"],
  ["soon", "1–3 days"],
  ["later", "4–14 days"],
  ["followup", "Needs follow-up"],
] as const;
export function DeadlineWorkspace({
  deadlines,
  followups,
  isAdmin = false,
  initialView = "all",
  initialTrack = "all",
}: {
  deadlines: DeadlineRow[];
  followups: StalledRow[];
  isAdmin?: boolean;
  initialView?: string;
  initialTrack?: string;
}) {
  const [view, setView] = useState(
    ["urgent", "week"].includes(initialView) ||
      VIEWS.some(([key]) => key === initialView)
      ? initialView
      : "all",
  );
  const [track, setTrack] = useState(
    ["upstream", "downstream"].includes(initialTrack) ? initialTrack : "all",
  );
  const scopedDeadlines = deadlines.filter(
    (d) => track === "all" || d.track === track,
  );
  const scopedFollowups = followups.filter(
    (d) => track === "all" || d.track === track,
  );
  function updateURL(nextView: string, nextTrack: string) {
    const params = new URLSearchParams({ view: nextView });
    if (nextTrack !== "all") params.set("track", nextTrack);
    history.replaceState(null, "", `/notifications?${params}`);
  }
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();
  const upcoming = scopedDeadlines.filter(
    (d) =>
      (view !== "today" || d.days === 0) &&
      (view !== "soon" || (d.days >= 1 && d.days <= 3)) &&
      (view !== "later" || d.days >= 4) &&
      (view !== "urgent" || d.days <= 3) &&
      (view !== "week" || d.days <= 7) &&
      `${d.customer} ${d.product} ${d.milestoneLabel}`
        .toLowerCase()
        .includes(needle),
  );
  const stalled = scopedFollowups.filter((d) =>
    `${d.customer} ${d.product} ${d.area}`.toLowerCase().includes(needle),
  );
  const groups = new Map<string, DeadlineRow[]>();
  for (const deadline of upcoming) {
    const group = groups.get(deadline.tenderId);
    if (group) group.push(deadline);
    else groups.set(deadline.tenderId, [deadline]);
  }
  const counts: Record<string, number> = {
    all: scopedDeadlines.length,
    today: scopedDeadlines.filter((d) => !d.days).length,
    soon: scopedDeadlines.filter((d) => d.days >= 1 && d.days <= 3).length,
    later: scopedDeadlines.filter((d) => d.days >= 4).length,
    followup: scopedFollowups.length,
  };
  function download() {
    const url = URL.createObjectURL(
      new Blob([deadlineCalendar(upcoming)], {
        type: "text/calendar;charset=utf-8",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "zekindo-deadlines.ics";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className={styles.page}>
      <PageHeading
        title="Deadlines"
        actions={
          view !== "followup" && (
            <Button
              variant="outline"
              disabled={!upcoming.length}
              onClick={download}
            >
              Download calendar
            </Button>
          )
        }
      />
      <div className={styles.pills} aria-label="Deadline views">
        {VIEWS.map(([key, label]) => (
          <Button
            variant="ghost"
            key={key}
            aria-label={label}
            aria-pressed={view === key}
            onClick={() => {
              setView(key);
              updateURL(key, track);
            }}
          >
            {label} · {counts[key]}
          </Button>
        ))}
      </div>
      <Card className={`${styles.panel} gap-0 py-0`}>
        <div className="flex flex-wrap items-center gap-3 border-b p-3">
          <div className="min-w-0 flex-1 basis-56">
            <h2 className="font-semibold">
              {view === "followup"
                ? "No upcoming milestone"
                : "Scheduled milestones"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {view === "followup"
                ? "These tenders need a result or an updated schedule; this does not mean they are overdue."
                : "Next 14 days · grouped by package, earliest first."}
            </p>
          </div>
          <NativeSelect
            aria-label="Deadline track"
            style={{ minWidth: 145 }}
            value={track}
            onChange={(e) => {
              setTrack(e.target.value);
              updateURL(view, e.target.value);
            }}
          >
            <NativeSelectOption value="all">Both tracks</NativeSelectOption>
            <NativeSelectOption value="upstream">Upstream</NativeSelectOption>
            <NativeSelectOption value="downstream">
              Downstream
            </NativeSelectOption>
          </NativeSelect>
          <Input
            type="search"
            aria-label="Search deadlines"
            className="control"
            style={{ maxWidth: 300 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, package, or milestone"
          />
        </div>
        {view === "followup"
          ? stalled.map((d) => (
              <Link
                href={
                  isAdmin
                    ? `/tenders/${d.tenderId}/edit?section=milestones`
                    : `/tenders/${d.tenderId}`
                }
                key={d.tenderId}
                className={styles.row}
              >
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{d.product}</span>
                  <span className={styles.rowSub}>{d.customer}</span>
                </span>
                <span className={styles.rowMeta}>
                  {d.lastMilestoneLabel || "No dates recorded"}
                  <br />
                  {d.lastMilestoneDateFormatted}
                  <br />
                  {isAdmin ? "Update schedule" : "View detail"}
                </span>
              </Link>
            ))
          : [...groups.values()].map(([d, ...rest], index, rows) => (
              <div key={d.tenderId}>
                {view === "all" &&
                  (index === 0 ||
                    windowLabel(rows[index - 1][0].days) !==
                      windowLabel(d.days)) && (
                    <h3 className="border-y bg-muted/40 px-4 py-1.5 text-xs font-semibold">
                      {windowLabel(d.days)}
                    </h3>
                  )}
                <Link
                  href={`/tenders/${d.tenderId}`}
                  key={d.tenderId}
                  className={styles.row}
                >
                  <span
                    className={`${styles.day} ${d.urgent ? styles.urgent : ""}`}
                  >
                    {d.days}
                    <small>{d.days === 0 ? "TODAY" : "DAYS"}</small>
                  </span>
                  <span className={styles.rowMain}>
                    <span className={styles.rowTitle}>
                      {d.product} <TrackBadge track={d.track} />
                    </span>
                    <span className={styles.rowSub}>{d.customer}</span>
                  </span>
                  <span className={styles.rowMeta}>
                    {d.milestoneLabel}
                    <br />
                    {d.dateFormatted}
                  </span>
                </Link>
                {rest.length > 0 && (
                  <details className="px-4 pb-3 text-sm">
                    <summary className="cursor-pointer text-primary">
                      {rest.length} more scheduled{" "}
                      {rest.length === 1 ? "stage" : "stages"}
                    </summary>
                    {rest.map((stage) => (
                      <p key={stage.milestoneKey}>
                        {stage.milestoneLabel} · {stage.dateFormatted}
                      </p>
                    ))}
                  </details>
                )}
              </div>
            ))}
        {(view === "followup" ? !stalled.length : !upcoming.length) && (
          <div className={styles.empty}>
            Nothing matches this view. Try another view or clear your search.
          </div>
        )}
      </Card>
    </div>
  );
}
