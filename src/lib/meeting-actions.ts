"use server";
import { requireUser } from "./auth/dal";
import { supabaseServer } from "./supabase-server";
import { getTenderById } from "./tenders";
import { getMilestoneTypes } from "./milestones";
import { resolveTenderMilestones } from "./tender-logic";
import { MEETING_COUNTS_TAG } from "./cache-tags";
import { revalidatePath, updateTag } from "next/cache";

const MAX_MEETINGS_PER_HOUR = 20;

export async function saveMeeting(
  tenderId: string,
  milestone: string,
  _: string,
  form: FormData,
): Promise<string> {
  const ctx = await requireUser(),
    db = supabaseServer(),
    t = await getTenderById(tenderId);
  if (!t || t.archivedAt) return "Tender unavailable.";
  const id = String(form.get("id") || ""),
    revision = Number(form.get("revision"));
  const cancel = form.get("intent") === "cancel";
  let organizer = ctx.userId;
  if (id) {
    const { data } = await db
      .from("tender_meetings")
      .select("*")
      .eq("id", id)
      .eq("tender_id", tenderId)
      .eq("milestone", milestone)
      .maybeSingle();
    if (
      !data ||
      data.cancelled ||
      (data.organizer !== ctx.userId && ctx.profile.role !== "admin")
    )
      return "Meeting unavailable.";
    organizer = data.organizer ?? ctx.userId;
  }
  if (!id && !cancel && ctx.profile.role !== "admin") {
    // Anyone may organise a meeting, but it sends email: cap how many a
    // non-admin can create per hour.
    const { count } = await db
      .from("tender_meetings")
      .select("id", { count: "exact", head: true })
      .eq("organizer", ctx.userId)
      .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
    if ((count ?? 0) >= MAX_MEETINGS_PER_HOUR)
      return "You have created many meetings in the last hour. Please try again later.";
  }
  const topic = String(form.get("topic") || "").trim(),
    local = String(form.get("time") || ""),
    link = String(form.get("link") || "").trim();
  const time = new Date(local + ":00+07:00");
  const participants = [
    ...new Set([organizer, ...form.getAll("member").map(String)]),
  ];
  const extra_emails = [
    ...new Set(
      String(form.get("emails") ?? "")
        .toLowerCase()
        .split(/[\s,;]+/)
        .filter(Boolean),
    ),
  ];
  if (
    !cancel &&
    (extra_emails.length > 50 ||
      extra_emails.some(
        (email) =>
          email.length > 254 ||
          !/^[a-z0-9_%+-]+(?:\.[a-z0-9_%+-]+)*@zekindo\.co\.id$/.test(email),
      ))
  )
    return "Enter up to 50 valid @zekindo.co.id addresses.";
  if (!cancel) {
    const stages = t.milestoneLabels ? [] : await getMilestoneTypes(t.track);
    if (
      !resolveTenderMilestones(t, { [t.track]: stages }).some(
        (m) => m.key === milestone,
      )
    )
      return "Milestone unavailable.";
    if (
      !topic ||
      topic.length > 180 ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(local) ||
      !(time.getTime() > Date.now())
    )
      return "Enter a topic and a future meeting time in WIB.";
    if (link) {
      try {
        if (!["https:", "http:"].includes(new URL(link).protocol))
          throw Error();
      } catch {
        return "Enter a valid meeting URL.";
      }
    }
  }
  const fields = cancel
    ? null
    : {
        topic,
        starts_at: time.toISOString(),
        link: link || null,
        participants,
        extra_emails,
        day_notice: form.has("day"),
        hour_notice: form.has("hour"),
      };
  const result = id
    ? await db
        .from("tender_meetings")
        .update({ ...fields, cancelled: cancel, revision: revision + 1 })
        .eq("id", id)
        .eq("revision", revision)
        .select("id")
        .maybeSingle()
    : fields
      ? await db
          .from("tender_meetings")
          .insert({
            ...fields,
            id: String(form.get("createId")),
            organizer,
            tender_id: tenderId,
            milestone,
          })
          .select("id")
          .single()
      : null;
  if (!result?.data || result.error)
    return "Could not save. Refresh and check the meeting and participants.";
  updateTag(MEETING_COUNTS_TAG);
  revalidatePath("/tenders");
  revalidatePath("/tenders/" + tenderId);
  revalidatePath("/tenders/" + tenderId + "/meetings");
  return "Saved";
}
