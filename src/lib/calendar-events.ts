import {
  REMINDER_DAYS,
  DUE_SOON_DAYS,
  daysBetween,
  resolveTenderMilestones,
  type MilestoneCatalog,
} from "./tender-logic";
import type { RegisterTender, Track } from "./types";

/** How a calendar entry is coloured. Closed = the tender already has a result. */
export type CalendarTone =
  | "closed"
  | "past"
  | "urgent"
  | "soon"
  | "upcoming"
  | "meeting";

/** One entry on the calendar. Deliberately carries no monetary field: the
 * calendar is visible to every role, restricted included. */
export interface CalendarEvent {
  id: string;
  kind: "milestone" | "meeting";
  /** Day in Asia/Jakarta, YYYY-MM-DD. */
  date: string;
  /** HH:MM (WIB), meetings only. */
  time?: string;
  title: string;
  tenderId: string;
  tenderLabel: string;
  customer: string;
  track: Track;
  milestoneKey: string;
  milestoneLabel: string;
  result: string | null;
  tone: CalendarTone;
  /** Days from today (negative = past). */
  days: number;
}

export interface CalendarMeeting {
  id: string;
  tenderId: string;
  milestone: string;
  topic: string;
  startsAt: string;
}

export type CalendarTender = Pick<
  RegisterTender,
  | "id"
  | "track"
  | "tenderNo"
  | "customer"
  | "product"
  | "milestoneLabels"
  | "milestones"
  | "milestoneOrder"
  | "result"
>;

const wibDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const wibTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function toneFor(days: number, result: string | null): CalendarTone {
  if (result) return "closed";
  if (days < 0) return "past";
  if (days <= REMINDER_DAYS) return "urgent";
  if (days <= DUE_SOON_DAYS) return "soon";
  return "upcoming";
}

/** `YYYY-MM` for the month containing `iso`, or null when malformed. */
export function parseMonth(value: string | undefined | null): string | null {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  return year >= 2000 && year <= 2100 ? value : null;
}

export function shiftMonth(month: string, offset: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return d.toISOString().slice(0, 7);
}

/** The 6×7 Monday-first grid that shows `month`, as ISO days. */
export function monthGrid(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7; // Monday = 0
  const start = Date.UTC(y, m - 1, 1 - offset);
  return Array.from({ length: 42 }, (_, i) =>
    new Date(start + i * 86400000).toISOString().slice(0, 10),
  );
}

/** Milestones and meetings falling within [from, to] (inclusive ISO days),
 * sorted by day, then meetings by time, then milestones by tender. */
export function buildCalendarEvents(
  tenders: CalendarTender[],
  meetings: CalendarMeeting[],
  range: { from: string; to: string; today: string },
  catalog?: MilestoneCatalog,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const byId = new Map<string, CalendarTender>();
  const stageLabels = new Map<string, string>();

  for (const t of tenders) {
    byId.set(t.id, t);
    const tenderLabel = t.product || t.tenderNo || t.id;
    for (const stage of resolveTenderMilestones(t as RegisterTender, catalog)) {
      stageLabels.set(`${t.id}:${stage.key}`, stage.label);
      if (!stage.date || stage.date < range.from || stage.date > range.to)
        continue;
      const days = daysBetween(stage.date, range.today);
      events.push({
        id: `m:${t.id}:${stage.key}`,
        kind: "milestone",
        date: stage.date,
        title: stage.label,
        tenderId: t.id,
        tenderLabel,
        customer: t.customer,
        track: t.track,
        milestoneKey: stage.key,
        milestoneLabel: stage.label,
        result: t.result,
        tone: toneFor(days, t.result),
        days,
      });
    }
  }

  for (const meeting of meetings) {
    const tender = byId.get(meeting.tenderId);
    if (!tender) continue; // archived or otherwise not visible
    const start = new Date(meeting.startsAt);
    if (Number.isNaN(start.getTime())) continue;
    const date = wibDate.format(start);
    if (date < range.from || date > range.to) continue;
    const label =
      stageLabels.get(`${tender.id}:${meeting.milestone}`) ?? meeting.milestone;
    events.push({
      id: `g:${meeting.id}`,
      kind: "meeting",
      date,
      time: wibTime.format(start),
      title: meeting.topic,
      tenderId: tender.id,
      tenderLabel: tender.product || tender.tenderNo || tender.id,
      customer: tender.customer,
      track: tender.track,
      milestoneKey: meeting.milestone,
      milestoneLabel: label,
      result: tender.result,
      tone: "meeting",
      days: daysBetween(date, range.today),
    });
  }

  return events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.kind === b.kind ? 0 : a.kind === "meeting" ? -1 : 1) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.tenderLabel.localeCompare(b.tenderLabel),
  );
}
