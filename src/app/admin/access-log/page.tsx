import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import {
  ACCESS_ACTIONS,
  getAccessLog,
  type AccessAction,
  type AccessLogEntry,
} from "@/lib/access-log";
import { PageHeading } from "@/components/PageHeading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const LABELS: Record<AccessAction, string> = {
  login: "Signed in",
  login_failed: "Failed sign-in",
  logout: "Signed out",
  logout_idle: "Signed out (idle)",
  export: "Excel export",
  download: "Document download",
};

const when = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta",
  dateStyle: "medium",
  timeStyle: "medium",
});

function describe(entry: AccessLogEntry): string {
  const d = entry.detail;
  switch (entry.action) {
    case "login_failed":
      return String(d.reason ?? "").replaceAll("_", " ");
    case "export":
      return `${d.rows ?? "?"} tenders · ${d.track ?? "all"}${d.query ? ` · ${d.query}` : ""}`;
    case "download":
      return `${d.file ?? "file"} · ${d.tender ?? d.tenderId ?? ""}`;
    default:
      return "";
  }
}

export default async function AccessLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  await requireAdmin();
  const { action: raw } = await searchParams;
  const action = ACCESS_ACTIONS.find((a) => a === raw);
  const { entries, error } = await getAccessLog({ action, limit: 300 });

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-7 md:px-8">
      <PageHeading
        eyebrow="ADMINISTRATION"
        title="Access log"
        description="Sign-ins, Excel exports and document downloads, newest first (WIB). Entries cannot be edited or deleted from the application."
      />
      <nav aria-label="Filter by event" className="mb-4 flex flex-wrap gap-2">
        {[undefined, ...ACCESS_ACTIONS].map((a) => (
          <Link
            key={a ?? "all"}
            href={a ? `/admin/access-log?action=${a}` : "/admin/access-log"}
            aria-current={a === action ? "page" : undefined}
            className="rounded-full border px-3 py-1 text-sm aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
          >
            {a ? LABELS[a] : "All events"}
          </Link>
        ))}
      </nav>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error} Apply migration 0017_access_log.sql if it is missing.
          </AlertDescription>
        </Alert>
      )}
      {!error && !entries.length && (
        <p className="text-muted-foreground">No events recorded yet.</p>
      )}
      {entries.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>IP address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">
                    <time dateTime={e.createdAt}>
                      {when.format(new Date(e.createdAt))}
                    </time>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        e.action === "login_failed" ? "destructive" : "secondary"
                      }
                    >
                      {LABELS[e.action] ?? e.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="break-all">{e.actorEmail ?? "—"}</TableCell>
                  <TableCell className="max-w-md break-words whitespace-normal">
                    {describe(e) || "—"}
                  </TableCell>
                  <TableCell
                    className="whitespace-nowrap"
                    title={e.userAgent ?? undefined}
                  >
                    {e.ip ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
