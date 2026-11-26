/** Which access-log events deserve an email to the security recipients. Pure,
 * so the rules are easy to read and test. Alerts never carry business data
 * beyond who/what/where. */
export const FAILED_LOGIN_BURST = 5;

const ALWAYS: Record<string, string> = {
  export: "Excel export",
  tender_deleted: "Tender deleted permanently",
  user_removed: "User removed",
  user_role_changed: "User role changed",
  user_password_reset: "User password reset by an administrator",
  twofactor_reset: "Two-factor reset by an administrator",
  twofactor_disabled: "Two-factor turned off",
};

export interface AlertInput {
  action: string;
  actorEmail?: string | null;
  detail?: Record<string, unknown>;
  /** Failed sign-ins for this email in the last 10 minutes, this one included. */
  recentFailures?: number;
}

export function alertFor(input: AlertInput): { subject: string; summary: string } | null {
  const d = input.detail ?? {};
  const who = input.actorEmail ?? "unknown";
  if (input.action === "login_failed") {
    if (d.reason === "throttled")
      return { subject: "Sign-in locked after repeated failures", summary: `Sign-ins for ${who} are temporarily locked.` };
    if (input.recentFailures === FAILED_LOGIN_BURST)
      return {
        subject: "Repeated failed sign-ins",
        summary: `${FAILED_LOGIN_BURST} failed sign-ins for ${who} within 10 minutes.`,
      };
    return null;
  }
  if (input.action === "user_created" && d.role === "admin")
    return { subject: "New administrator created", summary: `${who} created administrator ${d.target ?? ""}.` };
  const label = ALWAYS[input.action];
  if (!label) return null;
  const extra = [d.target, d.tender, d.rows != null ? `${d.rows} tenders` : null, d.from && d.to ? `${d.from} → ${d.to}` : null]
    .filter(Boolean)
    .join(" · ");
  return { subject: label, summary: `${label} by ${who}${extra ? ` (${extra})` : ""}.` };
}
