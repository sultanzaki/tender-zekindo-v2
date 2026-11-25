import { Card } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { ArchiveAction } from "@/components/ArchiveAction";
import { PageHeading } from "@/components/PageHeading";
import workspace from "@/components/Workspace.module.css";
import { getArchivedTenders } from "@/lib/tenders";
import { formatDateID } from "@/lib/tender-logic";
import { TrackBadge } from "@/components/TrackBadge";
import shared from "@/components/shared.module.css";
import tableStyles from "@/components/TenderTable.module.css";

export const dynamic = "force-dynamic";

export default async function ArchivedTendersPage() {
  await requireAdmin();
  const tenders = await getArchivedTenders();

  return (
    <div className={workspace.page}>
      <PageHeading
        eyebrow="ADMINISTRATION"
        title="Archived tenders"
        description="Restore archived work or permanently remove records you no longer need."
      />
      <Card className={shared.card}>
        <div className={shared.cardHeader}>
          <h2 className={shared.cardTitle}>
            {tenders.length} archived tender{tenders.length === 1 ? "" : "s"}
          </h2>
          <span className={shared.cardMeta}>Newest first</span>
        </div>
        {tenders.length > 0 ? (
          <div className={tableStyles.scroll}>
            <Table className={tableStyles.table}>
              <TableHeader>
                <TableRow className={tableStyles.theadRow}>
                  <TableHead className={tableStyles.th}>Area</TableHead>
                  <TableHead className={tableStyles.th}>Tender No.</TableHead>
                  <TableHead className={tableStyles.th}>Customer</TableHead>
                  <TableHead className={tableStyles.th}>Package</TableHead>
                  <TableHead className={tableStyles.th}>Archived</TableHead>
                  <TableHead className={tableStyles.th}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenders.map((t) => (
                  <TableRow
                    key={t.id}
                    className={tableStyles.bodyRow}
                    style={{ cursor: "default" }}
                  >
                    <TableCell className={tableStyles.td}>{t.area}</TableCell>
                    <TableCell
                      className={`${tableStyles.td} ${tableStyles.tdNoWrap}`}
                    >
                      {t.tenderNo || "—"} <TrackBadge track={t.track} />
                    </TableCell>
                    <TableCell
                      className={`${tableStyles.td} ${tableStyles.tdEllipsis}`}
                      style={{ maxWidth: 200 }}
                      title={t.customer}
                    >
                      <Link href={`/tenders/${t.id}`}>{t.customer}</Link>
                    </TableCell>
                    <TableCell
                      className={`${tableStyles.td} ${tableStyles.tdEllipsis}`}
                      style={{ maxWidth: 320 }}
                      title={t.product ?? undefined}
                    >
                      {t.product || "—"}
                    </TableCell>
                    <TableCell
                      className={`${tableStyles.td} ${tableStyles.tdNoWrap}`}
                    >
                      {t.archivedAt
                        ? formatDateID(t.archivedAt.slice(0, 10))
                        : "—"}
                    </TableCell>
                    <TableCell
                      className={`${tableStyles.td} ${tableStyles.tdNoWrap}`}
                      style={{ textAlign: "right" }}
                    >
                      <div style={{ display: "inline-flex", gap: 12 }}>
                        <ArchiveAction tenderId={t.id} action="restore" />
                        <ArchiveAction tenderId={t.id} action="delete" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className={tableStyles.emptyBox}>
            <div className={tableStyles.emptyText}>No archived tenders.</div>
          </div>
        )}
      </Card>
    </div>
  );
}
