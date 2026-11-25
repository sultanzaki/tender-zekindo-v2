import { requireUser } from "@/lib/auth/dal";
import { getAllTenders } from "@/lib/tenders";
import { getMilestoneCatalog } from "@/lib/milestones";
import { supabaseServer } from "@/lib/supabase-server";
import { todayISO } from "@/lib/tender-logic";
import {
  buildCalendarEvents,
  monthGrid,
  parseMonth,
  type CalendarMeeting,
} from "@/lib/calendar-events";
import { CalendarWorkspace } from "@/components/CalendarWorkspace";

export const dynamic = "force-dynamic";

/** Meetings in the visible grid (a day of slack either side for WIB). */
async function loadMeetings(from: string, to: string): Promise<CalendarMeeting[]> {
  const start = new Date(`${from}T00:00:00+07:00`);
  const end = new Date(`${to}T23:59:59+07:00`);
  const { data, error } = await supabaseServer()
    .from("tender_meetings")
    .select("id,tender_id,milestone,topic,starts_at")
    .eq("cancelled", false)
    .gte("starts_at", start.toISOString())
    .lte("starts_at", end.toISOString())
    .order("starts_at");
  // Before migration 0011 the table is absent: show milestones only.
  if (error) return [];
  return (data ?? []).map((m) => ({
    id: m.id,
    tenderId: m.tender_id,
    milestone: m.milestone,
    topic: m.topic,
    startsAt: m.starts_at,
  }));
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireUser();
  const today = todayISO();
  const { month: raw } = await searchParams;
  const month = parseMonth(raw) ?? today.slice(0, 7);
  const days = monthGrid(month);
  const range = { from: days[0], to: days[days.length - 1], today };
  const [tenders, catalog, meetings] = await Promise.all([
    getAllTenders(),
    getMilestoneCatalog(),
    loadMeetings(range.from, range.to),
  ]);
  // Only the visible weeks leave the server, and no monetary field at all.
  const events = buildCalendarEvents(tenders, meetings, range, catalog);
  return (
    <CalendarWorkspace
      month={month}
      days={days}
      today={today}
      events={events}
    />
  );
}
