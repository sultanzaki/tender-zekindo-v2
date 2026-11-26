import "server-only";
import { after } from "next/server";
import { alertFor, type AlertInput } from "./alert-rules";

/** Emails SECURITY_ALERT_RECIPIENTS (comma separated) through Resend. Silent when
 * not configured, and never throws: an alert must not break the action that
 * triggered it. Runs after the response when inside a request. */
export function sendSecurityAlert(
  input: AlertInput & { ip?: string | null; at?: Date },
): void {
  const rule = alertFor(input);
  const key = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL;
  const to = (process.env.SECURITY_ALERT_RECIPIENTS ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))
    .slice(0, 20);
  if (!rule || !key || !from || !to.length) return;
  const when = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(input.at ?? new Date());
  const text = `${rule.summary}\n\nWhen: ${when} WIB\nFrom: ${input.ip ?? "unknown address"}\n\nReview it under Settings → Access log.`;
  const send = async () => {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({ from, to, subject: `[Tender security] ${rule.subject}`, text }),
      });
      if (!response.ok) console.error("Security alert not delivered:", response.status);
    } catch (error) {
      console.error("Security alert failed:", error);
    }
  };
  try {
    after(send);
  } catch {
    void send();
  }
}
