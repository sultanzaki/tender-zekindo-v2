import Link from "next/link";
import type { ComponentProps } from "react";
import type { Meeting } from "@/lib/database.types";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { getTenderById } from "@/lib/tenders";
import { getMilestoneTypes } from "@/lib/milestones";
import { formatDateID, resolveTenderMilestones } from "@/lib/tender-logic";
import { Button } from "@/components/ui/button";
import { supabaseServer } from "@/lib/supabase-server";
import { MeetingForm } from "@/components/MeetingForm";

function MeetingCard({
m,
names,
canManage,
formProps,
}: {
m: Meeting;
names: Map<string, string>;
canManage: boolean;
formProps: Omit<ComponentProps<typeof MeetingForm>, "meeting">;
}) {
  const start = new Date(m.starts_at);
  const part = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", ...o }).format(start);
  const attendees = m.participants
    .map((p) => names.get(p))
    .filter(Boolean)
    .concat(m.extra_emails ?? []) as string[];
  return (
    <article
      className="grid grid-cols-[64px_minmax(0,1fr)] gap-4 rounded-xl border bg-card p-4 data-[cancelled=true]:opacity-60"
      data-cancelled={m.cancelled}
    >
      <div className="grid h-16 place-content-center rounded-lg bg-accent text-center text-accent-foreground">
        <span className="text-[11px] font-semibold uppercase">{part({ month: "short" })}</span>
        <span className="text-2xl leading-none font-semibold tabular-nums">{part({ day: "numeric" })}</span>
      </div>
      <div className="grid min-w-0 gap-1.5">
        <h3 className="font-semibold break-words">
          {m.topic}
          {m.cancelled && (
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Cancelled
            </span>
          )}
        </h3>
        <p className="text-sm text-muted-foreground">
          <time dateTime={m.starts_at}>
            {part({ weekday: "long", day: "numeric", month: "long", year: "numeric" })} ·{" "}
            {part({ hour: "2-digit", minute: "2-digit", hour12: false })} WIB
          </time>
        </p>
        <p className="text-sm">
          <span className="text-muted-foreground">{attendees.length} participant{attendees.length === 1 ? "" : "s"}: </span>
          {attendees.join(", ")}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {m.link && !m.cancelled && (
            <Button asChild size="sm">
              <a href={m.link} target="_blank" rel="noreferrer">
                Join meeting
              </a>
            </Button>
          )}
          {canManage && <MeetingForm key={m.revision} {...formProps} meeting={m} />}
        </div>
      </div>
    </article>
  );
}


/** Server time for splitting upcoming from past meetings. */
function nowMs() {
  return Date.now();
}

export default async function Meetings({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ milestone?: string }>;
}) {
  const ctx = await requireUser(),
    { id } = await params,
    { milestone } = await searchParams;
  if (!milestone) notFound();
  const db = supabaseServer(),
    [t, rows, people] = await Promise.all([
      getTenderById(id),
      db
        .from("tender_meetings")
        .select("*")
        .eq("tender_id", id)
        .eq("milestone", milestone)
        .order("starts_at"),
      db.from("profiles").select("id,name").order("name"),
    ]);
  if (!t) notFound();
  if (rows.error || people.error) throw Error("Could not load meeting agenda.");
  const catalog = t.milestoneLabels ? undefined : { [t.track]: await getMilestoneTypes(t.track) };
  const stage = resolveTenderMilestones(t, catalog).find(
    (m) => m.key === milestone,
  );
  if (!stage && !rows.data.length) notFound();
  const props = {
    tender: id,
    stage: milestone,
    user: ctx.userId,
    members: people.data,
  };
  const now = nowMs();
  const names = new Map(people.data.map((p) => [p.id, p.name]));
  const upcoming = rows.data.filter((m) => !m.cancelled && Date.parse(m.starts_at) >= now);
  const past = rows.data.filter((m) => m.cancelled || Date.parse(m.starts_at) < now).reverse();
  const stageLabel = stage?.label ?? t.milestoneLabels?.[milestone] ?? milestone;

  return (
    <main className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-7 md:px-8">
      <Link href={"/tenders/" + id} className="text-sm">
        ← Back to tender
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Meetings · {stageLabel}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight break-words">
            {t.product || t.customer}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.customer}
            {t.tenderNo ? ` · ${t.tenderNo}` : ""}
            {stage?.date ? ` · ${stageLabel} on ${formatDateID(stage.date)}` : ""}
          </p>
        </div>
        {stage && !t.archivedAt && <MeetingForm key={rows.data.length} {...props} />}
      </header>
      <section className="grid gap-3" aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading" className="text-sm font-semibold text-muted-foreground">
          Upcoming
        </h2>
        {upcoming.length ? (
          upcoming.map((m) => <MeetingCard
              key={m.id}
              m={m}
              names={names}
              formProps={props}
              canManage={!t.archivedAt && !m.cancelled && (ctx.userId === m.organizer || ctx.profile.role === "admin")}
            />)
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No upcoming meetings for this milestone.
            {stage && !t.archivedAt && " Use Add meeting to schedule one; participants get email reminders."}
          </p>
        )}
      </section>
      {past.length > 0 && (
        <section className="grid gap-3" aria-labelledby="past-heading">
          <h2 id="past-heading" className="text-sm font-semibold text-muted-foreground">
            Past and cancelled
          </h2>
          {past.map((m) => <MeetingCard
              key={m.id}
              m={m}
              names={names}
              formProps={props}
              canManage={!t.archivedAt && !m.cancelled && (ctx.userId === m.organizer || ctx.profile.role === "admin")}
            />)}
        </section>
      )}
    </main>
  );
}
