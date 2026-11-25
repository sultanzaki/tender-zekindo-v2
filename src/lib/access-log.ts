import "server-only";
import { headers } from "next/headers";
import { supabaseServer } from "./supabase-server";
import { requireAdmin } from "./auth/dal";

export type AccessAction =
  | "login"
  | "login_failed"
  | "logout"
  | "logout_idle"
  | "export"
  | "download";

export const ACCESS_ACTIONS: AccessAction[] = [
  "login",
  "login_failed",
  "logout",
  "logout_idle",
  "export",
  "download",
];

export interface AccessLogEntry {
  id: number;
  createdAt: string;
  actorEmail: string | null;
  action: AccessAction;
  detail: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
}

/** The client address as Vercel reports it: the first x-forwarded-for hop. */
function clientIp(h: Headers): string | null {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || h.get("x-real-ip") || "").slice(0, 64) || null;
}

/** Records one access event. Returns false when the row could not be stored;
 * callers handing out data (export, download) refuse in that case, so nothing
 * leaves the application unrecorded. */
export async function logAccess(entry: {
  action: AccessAction;
  actorId?: string | null;
  actorEmail?: string | null;
  detail?: Record<string, unknown>;
}): Promise<boolean> {
  try {
    const h = await headers();
    const { error } = await supabaseServer().from("access_log").insert({
      action: entry.action,
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail?.slice(0, 254) ?? null,
      detail: entry.detail ?? {},
      ip: clientIp(h),
      user_agent: h.get("user-agent")?.slice(0, 300) ?? null,
    });
    if (error) {
      console.error("Failed to write access_log row:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Failed to write access_log row:", error);
    return false;
  }
}

/** The newest entries for the administrator view, optionally one action. */
export async function getAccessLog(options: {
  action?: AccessAction;
  limit?: number;
}): Promise<{ entries: AccessLogEntry[]; error: string | null }> {
  await requireAdmin();
  let query = supabaseServer()
    .from("access_log")
    .select("id, created_at, actor_email, action, detail, ip, user_agent")
    .order("created_at", { ascending: false })
    .limit(Math.min(options.limit ?? 200, 500));
  if (options.action) query = query.eq("action", options.action);
  const { data, error } = await query;
  if (error)
    return { entries: [], error: "The access log could not be loaded." };
  return {
    entries: (data ?? []).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      actorEmail: row.actor_email,
      action: row.action as AccessAction,
      detail: row.detail ?? {},
      ip: row.ip,
      userAgent: row.user_agent,
    })),
    error: null,
  };
}
