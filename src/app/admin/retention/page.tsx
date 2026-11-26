import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { supabaseServer } from "@/lib/supabase-server";
import { ARCHIVE_REVIEW_YEARS, RETENTION_POLICY } from "@/lib/retention-policy";
import { PageHeading } from "@/components/PageHeading";
import workspace from "@/components/Workspace.module.css";

export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta",
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function RetentionPage() {
  await requireAdmin();
  const db = supabaseServer();
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - ARCHIVE_REVIEW_YEARS);
  const [lastRun, due] = await Promise.all([
    db
      .from("access_log")
      .select("created_at, detail")
      .eq("action", "retention_run")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("tenders")
      .select("id, tender_no, customer, product, archived_at", { count: "exact" })
      .not("archived_at", "is", null)
      .lt("archived_at", cutoff.toISOString())
      .order("archived_at", { ascending: true })
      .limit(50),
  ]);
  const rows = due.data ?? [];
  return (
    <section className={workspace.page}>
      <PageHeading
        eyebrow="ADMINISTRATION"
        title="Data retention"
        description="How long each kind of data is kept, and what happens when that time is up."
      />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {lastRun.data
          ? `Last automatic clean-up: ${when.format(new Date(lastRun.data.created_at))} WIB.`
          : "The automatic clean-up has not run yet. It runs daily once deployed."}
      </p>
      <ul className="grid max-w-4xl gap-2" aria-label="Retention policy">
        {RETENTION_POLICY.map((row) => (
          <li key={row.data} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <strong>{row.data}</strong>
              <span className="text-sm font-medium">{row.period}</span>
            </div>
            <p className="text-sm text-muted-foreground">{row.detail}</p>
            <p className="mt-1 text-sm">{row.after}</p>
          </li>
        ))}
      </ul>
      <h2 className="mt-4 text-lg font-semibold">
        Archived tenders due for review ({due.count ?? rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="max-w-4xl rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          Nothing due. No tender has been archived for more than {ARCHIVE_REVIEW_YEARS} years.
        </p>
      ) : (
        <ul className="grid max-w-4xl gap-1 rounded-xl border bg-card p-2">
          {rows.map((t) => (
            <li key={t.id}>
              <Link
                href={`/tenders/${t.id}`}
                data-slot="retention-link"
                className="flex flex-wrap justify-between gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"
              >
                <span>
                  <strong>{t.tender_no || t.product || t.id}</strong> · {t.customer}
                </span>
                <span className="text-muted-foreground">
                  Archived {when.format(new Date(t.archived_at!))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
