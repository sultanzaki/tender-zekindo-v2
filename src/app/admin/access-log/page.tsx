import { requireAdmin } from "@/lib/auth/dal";
import {
  ACCESS_ACTIONS,
  getAccessLog,
  type AccessAction,
  type AccessLogEntry,
} from "@/lib/access-log";
import { PageHeading } from "@/components/PageHeading";
import workspace from "@/components/Workspace.module.css";
import { AccessLogFilters } from "@/components/AccessLogFilters";
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
  user_created: "User created",
  user_role_changed: "Role changed",
  user_password_reset: "Password reset",
  user_removed: "User removed",
  tender_deleted: "Tender deleted",
  twofactor_enabled: "2FA enabled",
  twofactor_disabled: "2FA disabled",
  twofactor_reset: "2FA reset by admin",
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
    case "user_role_changed":
      return `${d.target ?? ""} · ${d.from ?? "?"} → ${d.to ?? "?"}`;
    case "user_created":
      return `${d.target ?? ""} · ${d.role ?? ""}`;
    case "tender_deleted":
      return String(d.tender ?? d.tenders ?? "");
    case "user_password_reset":
    case "user_removed":
    case "twofactor_reset":
      return String(d.target ?? "");
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
    <section className={workspace.page}>
      <PageHeading
        eyebrow="ADMINISTRATION"
        title="Access log"
        description="Sign-ins, Excel exports and document downloads, newest first (WIB). Entries cannot be edited or deleted from the application."
      />
      <AccessLogFilters actions={ACCESS_ACTIONS} labels={LABELS} active={action} />
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
        <ul className="grid gap-2 md:hidden" aria-label="Access events">
          {entries.map((e) => (
            <li key={e.id} className="grid gap-1 rounded-lg border bg-card p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant={e.action === "login_failed" ? "destructive" : "secondary"}>
                  {LABELS[e.action] ?? e.action}
                </Badge>
                <time dateTime={e.createdAt} className="text-xs text-muted-foreground">
                  {when.format(new Date(e.createdAt))}
                </time>
              </div>
              <span className="break-all font-medium">{e.actorEmail ?? "—"}</span>
              {describe(e) && <span className="text-muted-foreground">{describe(e)}</span>}
              <span className="text-xs text-muted-foreground">IP {e.ip ?? "—"}</span>
            </li>
          ))}
        </ul>
      )}
      {entries.length > 0 && (
        <div className="hidden overflow-x-auto rounded-lg border md:block">
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
