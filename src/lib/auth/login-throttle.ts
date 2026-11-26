import "server-only";
import { supabaseServer } from "../supabase-server";

/** Failed sign-ins are counted from access_log, which every server instance
 * shares — a per-process counter would reset on each cold start and be
 * bypassed by simply landing on another instance. Counting is fixed-window:
 * throttled attempts are not counted again, so a lockout ends 15 minutes after
 * the failures that caused it. */
export const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILURES_PER_EMAIL = 10;
export const MAX_FAILURES_PER_IP = 30;

export function exceedsLoginLimits(counts: {
  email: number;
  ip: number | null;
}): boolean {
  return (
    counts.email >= MAX_FAILURES_PER_EMAIL ||
    (counts.ip !== null && counts.ip >= MAX_FAILURES_PER_IP)
  );
}

/** Throws when the log cannot be read: sign-in then fails closed. */
export async function isLoginThrottled(
  email: string,
  ip: string | null,
  now = Date.now(),
): Promise<boolean> {
  const since = new Date(now - THROTTLE_WINDOW_MS).toISOString();
  const count = async (column: "actor_email" | "ip", value: string) => {
    const { count, error } = await supabaseServer()
      .from("access_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "login_failed")
      .eq(column, value)
      .neq("detail->>reason", "throttled")
      .gte("created_at", since);
    if (error) throw new Error("Unable to read the access log.");
    return count ?? 0;
  };
  return exceedsLoginLimits({
    email: await count("actor_email", email),
    ip: ip ? await count("ip", ip) : null,
  });
}
