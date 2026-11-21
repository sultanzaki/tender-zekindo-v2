import { renderMeetingEmail } from "@/lib/meeting-email";
import { authorized } from "@/lib/cron-auth";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(request: Request) {
  if (!authorized(request))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const key = process.env.RESEND_API_KEY,
    from = process.env.REMINDER_FROM_EMAIL;
  if (!key || !from)
    return Response.json({ error: "Configure Resend sender" }, { status: 503 });
  const db = supabaseServer();
  const jobs = await db.rpc("claim_meeting_mail", {});
  if (jobs.error)
    return Response.json(
      { error: "Could not claim reminders" },
      { status: 503 },
    );
  let sent = 0,
    failed = 0;
  for (const job of jobs.data) {
    try {
      const [profile, pending] = await Promise.all([
        job.recipient
          ? db
              .from("profiles")
              .select("email")
              .eq("id", job.recipient)
              .maybeSingle()
          : {
              data: job.extra_email ? { email: job.extra_email } : null,
              error: null,
            },
        db
          .from("meeting_mail")
          .select("id")
          .eq("id", job.id)
          .is("sent_at", null)
          .maybeSingle(),
      ]);
      if (profile.error || pending.error) throw Error();
      if (
        !profile.data ||
        !pending.data ||
        Date.parse(job.expires_at) <= Date.now()
      )
        continue;
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
          "Idempotency-Key": "tender-meeting/" + job.id,
        },
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({
          from,
          to: [profile.data.email],
          subject: job.subject,
          text: job.body,
          html: renderMeetingEmail(job.subject, job.body),
        }),
      });
      if (!response.ok) throw Error();
      const result = await db
        .from("meeting_mail")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", job.id);
      if (result.error) throw Error();
      sent++;
    } catch {
      failed++;
    }
  }
  return Response.json({ sent, failed }, { status: failed ? 502 : 200 });
}
