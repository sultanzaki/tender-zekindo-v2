"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  List,
  Users,
} from "lucide-react";
import {
  shiftMonth,
  type CalendarEvent,
  type CalendarTone,
} from "@/lib/calendar-events";
import { TRACK_LABELS, type Track } from "@/lib/types";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import styles from "./CalendarWorkspace.module.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_CHIPS = 3;

const TONE_LABELS: Record<CalendarTone, string> = {
  urgent: "Due in 0–3 days",
  soon: "Due in 4–14 days",
  upcoming: "Later",
  past: "Passed, awaiting result",
  closed: "Tender closed",
  meeting: "Internal meeting",
};
const LEGEND: CalendarTone[] = ["urgent", "soon", "upcoming", "meeting", "past", "closed"];

const monthTitle = (month: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T00:00:00Z`));
const dayTitle = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));

function relative(days: number) {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

type View = "month" | "agenda";
type TrackFilter = Track | "all";

export function CalendarWorkspace({
  month,
  days,
  today,
  events,
}: {
  month: string;
  days: string[];
  today: string;
  events: CalendarEvent[];
}) {
  const [view, setView] = useState<View>("month");
  const [track, setTrack] = useState<TrackFilter>("all");
  const [showMeetings, setShowMeetings] = useState(true);
  const [hideClosed, setHideClosed] = useState(false);

  const visible = useMemo(
    () =>
      events.filter(
        (e) =>
          (track === "all" || e.track === track) &&
          (showMeetings || e.kind !== "meeting") &&
          (!hideClosed || e.tone !== "closed"),
      ),
    [events, track, showMeetings, hideClosed],
  );
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of visible) (map.get(e.date) ?? map.set(e.date, []).get(e.date)!).push(e);
    return map;
  }, [visible]);

  const inMonth = visible.filter((e) => e.date.startsWith(month));
  const stats = {
    milestones: inMonth.filter((e) => e.kind === "milestone").length,
    urgent: inMonth.filter((e) => e.tone === "urgent").length,
    meetings: inMonth.filter((e) => e.kind === "meeting").length,
  };
  const isCurrentMonth = today.startsWith(month);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Schedule</p>
          <h1 className={styles.title}>
            <span>{monthTitle(month)}</span>
          </h1>
          <p className={styles.summary} aria-live="polite">
            {stats.milestones} milestone{stats.milestones === 1 ? "" : "s"}
            {stats.urgent > 0 && (
              <>
                {" · "}
                <strong className={styles.summaryUrgent}>
                  {stats.urgent} due within 3 days
                </strong>
              </>
            )}
            {showMeetings && ` · ${stats.meetings} meeting${stats.meetings === 1 ? "" : "s"}`}
          </p>
        </div>
        <nav className={styles.monthNav} aria-label="Change month">
          <Button asChild variant="outline" size="icon">
            <Link href={`/calendar?month=${shiftMonth(month, -1)}`} aria-label="Previous month">
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild variant={isCurrentMonth ? "secondary" : "outline"}>
            <Link href="/calendar" aria-current={isCurrentMonth ? "date" : undefined}>
              Today
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon">
            <Link href={`/calendar?month=${shiftMonth(month, 1)}`} aria-label="Next month">
              <ChevronRight />
            </Link>
          </Button>
        </nav>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.segmented} role="group" aria-label="Track">
          {(["all", "upstream", "downstream"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={track === t}
              onClick={() => setTrack(t)}
            >
              {t === "all" ? "All tracks" : TRACK_LABELS[t]}
            </button>
          ))}
        </div>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={showMeetings}
            onChange={(e) => setShowMeetings(e.target.checked)}
          />
          Meetings
        </label>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={hideClosed}
            onChange={(e) => setHideClosed(e.target.checked)}
          />
          Hide closed tenders
        </label>
        <div className={`${styles.segmented} ${styles.viewSwitch}`} role="group" aria-label="View">
          <button type="button" aria-pressed={view === "month"} onClick={() => setView("month")}>
            <CalendarDays aria-hidden="true" /> Month
          </button>
          <button type="button" aria-pressed={view === "agenda"} onClick={() => setView("agenda")}>
            <List aria-hidden="true" /> Agenda
          </button>
        </div>
      </div>

      <ul className={styles.legend} aria-label="Legend">
        {LEGEND.filter((t) => showMeetings || t !== "meeting").map((t) => (
          <li key={t}>
            <span className={styles.swatch} data-tone={t} aria-hidden="true" />
            {TONE_LABELS[t]}
          </li>
        ))}
      </ul>

      <section
        className={styles.grid}
        data-view={view}
        aria-label={`${monthTitle(month)} month view`}
      >
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={styles.weekday} data-weekend={i >= 5 || undefined}>
            {d}
          </div>
        ))}
        {days.map((day, i) => {
          const list = byDay.get(day) ?? [];
          const outside = !day.startsWith(month);
          const shown = list.slice(0, list.length > MAX_CHIPS ? MAX_CHIPS - 1 : MAX_CHIPS);
          const hidden = list.length - shown.length;
          return (
            <div
              key={day}
              className={styles.day}
              data-outside={outside || undefined}
              data-weekend={i % 7 >= 5 || undefined}
              data-today={day === today || undefined}
              data-past={day < today || undefined}
            >
              <div className={styles.dayHead}>
                <span className={styles.dayNumber} aria-label={dayTitle(day)}>
                  {Number(day.slice(8))}
                </span>
                {list.some((e) => e.tone === "urgent") && (
                  <span className={styles.urgentDot} title="Deadline within 3 days" />
                )}
              </div>
              <ul className={styles.chips}>
                {shown.map((e) => (
                  <li key={e.id}>
                    <EventChip event={e} />
                  </li>
                ))}
                {hidden > 0 && (
                  <li>
                    <DayOverflow day={day} events={list} count={hidden} />
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </section>

      <section
        className={styles.agenda}
        data-view={view}
        aria-label={`${monthTitle(month)} agenda`}
      >
        {days
          .filter((d) => d.startsWith(month) && byDay.has(d))
          .map((day) => (
            <div key={day} className={styles.agendaDay} data-today={day === today || undefined}>
              <div className={styles.agendaDate}>
                <span className={styles.agendaWeekday}>
                  {dayTitle(day).split(" ")[0].slice(0, 3)}
                </span>
                <span className={styles.agendaNumber}>{Number(day.slice(8))}</span>
              </div>
              <ul className={styles.agendaList}>
                {byDay.get(day)!.map((e) => (
                  <li key={e.id}>
                    <EventDetail event={e} compact />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        {!inMonth.length && (
          <div className={styles.empty}>
            <CalendarDays aria-hidden="true" />
            <p>Nothing scheduled in {monthTitle(month)} for these filters.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function EventChip({ event }: { event: CalendarEvent }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={styles.chip}
          data-tone={event.tone}
          aria-label={`${event.kind === "meeting" ? `Meeting ${event.time}` : event.milestoneLabel}: ${event.tenderLabel}`}
        >
          {event.kind === "meeting" ? (
            <span className={styles.chipTime}>{event.time}</span>
          ) : (
            <span className={styles.chipBar} aria-hidden="true" />
          )}
          <span className={styles.chipText}>
            <span className={styles.chipTitle}>
              {event.kind === "meeting" ? event.title : event.milestoneLabel}
            </span>
            <span className={styles.chipSub}>{event.tenderLabel}</span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={styles.popover}>
        <EventDetail event={event} />
      </PopoverContent>
    </Popover>
  );
}

function DayOverflow({
  day,
  events,
  count,
}: {
  day: string;
  events: CalendarEvent[];
  count: number;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={styles.more}>
          +{count} more
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={`${styles.popover} ${styles.dayPopover}`}>
        <p className={styles.popoverDay}>{dayTitle(day)}</p>
        <ul className={styles.popoverList}>
          {events.map((e) => (
            <li key={e.id}>
              <EventDetail event={e} compact />
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function EventDetail({ event, compact = false }: { event: CalendarEvent; compact?: boolean }) {
  const meeting = event.kind === "meeting";
  const href = meeting
    ? `/tenders/${encodeURIComponent(event.tenderId)}/meetings?${new URLSearchParams({ milestone: event.milestoneKey })}`
    : `/tenders/${encodeURIComponent(event.tenderId)}`;
  return (
    <article className={styles.detail} data-tone={event.tone} data-compact={compact || undefined}>
      <div className={styles.detailTop}>
        <span className={styles.detailKind}>
          {meeting ? (
            <>
              <Users aria-hidden="true" /> Meeting · {event.milestoneLabel}
            </>
          ) : (
            <>
              <span className={styles.swatch} data-tone={event.tone} aria-hidden="true" />
              {event.milestoneLabel}
            </>
          )}
        </span>
        <span className={styles.detailWhen}>
          {meeting && (
            <>
              <Clock aria-hidden="true" /> {event.time} WIB ·{" "}
            </>
          )}
          {event.result ? event.result : relative(event.days)}
        </span>
      </div>
      {meeting && <p className={styles.detailMeeting}>{event.title}</p>}
      <Link href={href} className={styles.detailTitle}>
        {event.tenderLabel}
        <ExternalLink aria-hidden="true" />
      </Link>
      <p className={styles.detailMeta}>
        {event.customer}
        {event.track === "downstream" && <span className={styles.trackTag}>Downstream</span>}
      </p>
    </article>
  );
}
