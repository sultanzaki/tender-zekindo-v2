import { supabaseServer } from "./supabase-server";
import { requireUser } from "./auth/dal";
export async function meetingCounts(id?: string) {
  await requireUser();
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
