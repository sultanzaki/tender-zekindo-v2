import { supabaseServer } from "./supabase-server";
import { requireUser } from "./auth/dal";
import { unstable_cache } from "next/cache";
import { MEETING_COUNTS_TAG, TENDERS_TAG } from "./cache-tags";

async function loadMeetingCounts(id?: string) {
  const counts: Record<string, Record<string, number>> = {};
  for (let offset = 0; ; offset += 1000) {
    let query = supabaseServer()
      .from("meeting_counts")
      .select("*")
      .order("tender_id")
      .order("milestone")
      .range(offset, offset + 999);
    if (id) query = query.eq("tender_id", id);
    const { data, error } = await query;
    if (error) {
      if (error.code === "PGRST205" || error.code === "42P01") return counts;
      throw Error("Could not load meeting counts.");
    }
    for (const row of data)
      (counts[row.tender_id] ??= {})[row.milestone] = row.count;
    if (data.length < 1000) return counts;
  }
}

const cachedCounts = unstable_cache(loadMeetingCounts,
  ["meeting-counts", process.env.SUPABASE_URL || "unconfigured"],
  { tags: [MEETING_COUNTS_TAG, TENDERS_TAG], revalidate: 30 },
);

export async function meetingCounts(id?: string) {
  await requireUser();
  return cachedCounts(id);
}
