import { authorized } from "@/lib/cron-auth";
import { logAccess } from "@/lib/access-log";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Daily purge of short-lived data (see src/lib/retention-policy.ts). Business
 * records are never deleted here. */
export async function GET(request: Request) {
  if (!authorized(request))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabaseServer().rpc("apply_retention");
  if (error) {
    console.error("Retention run failed:", error.message);
    return Response.json({ error: "Retention run failed" }, { status: 500 });
  }
  await logAccess({ action: "retention_run", detail: data ?? {} });
  return Response.json({ purged: data });
}
