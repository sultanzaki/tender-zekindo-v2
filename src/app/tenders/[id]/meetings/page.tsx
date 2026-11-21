import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { getTenderById } from "@/lib/tenders";
import { getMilestoneTypes } from "@/lib/milestones";
import { resolveTenderMilestones } from "@/lib/tender-logic";
import { supabaseServer } from "@/lib/supabase-server";
import { MeetingForm } from "@/components/MeetingForm";

export default async function Meetings({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ milestone?: string }>;
}) {
  const ctx = await requireUser(),
    { id } = await params,
    { milestone } = await searchParams,
    t = await getTenderById(id);
  if (!t || !milestone) notFound();
  const db = supabaseServer(),
    [catalog, rows, people] = await Promise.all([
      getMilestoneTypes(t.track),
      db
        .from("tender_meetings")
        .select("*")
        .eq("tender_id", id)
        .eq("milestone", milestone)
        .order("starts_at"),
      db.from("profiles").select("id,name").order("name"),
    ]);
  if (rows.error || people.error) throw Error("Could not load meeting agenda.");
  const stage = resolveTenderMilestones(t, { [t.track]: catalog }).find(
    (m) => m.key === milestone,
  );
  if (!stage && !rows.data.length) notFound();
  const props = {
    tender: id,
    stage: milestone,
    user: ctx.userId,
    members: people.data,
  };
  return (
    <main className="mx-auto grid max-w-3xl gap-5 p-4 md:p-8">
      <Link href={"/tenders/" + id}>← Tender detail</Link>
      <header>
        <h1 className="text-2xl font-semibold">
          {stage?.label ?? milestone} meetings
        </h1>
        <p>{t.product || t.customer}</p>
      </header>
      {stage && !t.archivedAt && (
        <div>
          <MeetingForm key={rows.data.length} {...props} />
        </div>
      )}
      {!rows.data.length && <p>No meetings scheduled.</p>}
      {rows.data.map((m) => (
        <article key={m.id} className="grid gap-2 border-t py-4">
          <h2 className="font-semibold">
            {m.topic}
            {m.cancelled ? " · Cancelled" : ""}
          </h2>
          <time dateTime={m.starts_at}>
            {new Date(m.starts_at).toLocaleString("id-ID", {
              dateStyle: "full",
              timeStyle: "short",
              timeZone: "Asia/Jakarta",
            })}{" "}
            WIB
          </time>
          <p className="text-sm">
            {people.data
              .filter((p) => m.participants.includes(p.id))
              .map((p) => p.name)
              .join(", ")}
          </p>
          {m.link && !m.cancelled && (
            <a
              className="text-primary"
              href={m.link}
              target="_blank"
              rel="noreferrer"
            >
              Join meeting
            </a>
          )}
          {!t.archivedAt &&
            !m.cancelled &&
            (ctx.userId === m.organizer || ctx.profile.role === "admin") && (
              <div>
                <MeetingForm key={m.revision} {...props} meeting={m} />
              </div>
            )}
        </article>
      ))}
    </main>
  );
}
