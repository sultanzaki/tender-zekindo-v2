import { meetingCounts } from "@/lib/meeting-counts";
import { requireUser } from "@/lib/auth/dal";
import { getAllTenders } from "@/lib/tenders";
import { getMilestoneCatalog } from "@/lib/milestones";
import { todayISO } from "@/lib/tender-logic";
import { RegisterWorkspace } from "@/components/RegisterWorkspace";

export const dynamic = "force-dynamic";

export default async function TenderTablePage() {
  const ctx = await requireUser();
  const [rows, catalog, counts] = await Promise.all([
    getAllTenders(),
    getMilestoneCatalog(),
    meetingCounts(),
  ]);
  // Share identical snapshots in the Flight payload (usually one per track).
  const snapshots = new Map<string, Record<string, string>>();
  function shareSnapshot(labels?: Record<string, string>) {
    if (!labels) return undefined;
    const key = JSON.stringify(labels);
    const cached = snapshots.get(key);
    if (cached) return cached;
    snapshots.set(key, labels);
    return labels;
  }
  const orders = new Map<string, string[]>();
  function shareOrder(keys: string[] | null) {
    if (!keys) return null;
    const key = JSON.stringify(keys);
    const cached = orders.get(key);
    if (cached) return cached;
    orders.set(key, keys);
    return keys;
  }
  return (
    <RegisterWorkspace
      rows={rows.map(
        ({
          id,
          rowNo,
          track,
          period,
          area,
          tenderNo,
          customer,
          product,
          entitas,
          qty,
          oe,
          milestoneOrder,
          milestoneLabels,
          result,
          pnl,
          nilaiPenawaran,
          milestones,
        }) => ({
          id,
          rowNo,
          track,
          period,
          area,
          tenderNo,
          customer,
          product,
          entitas,
          qty,
          oe,
          milestoneOrder: shareOrder(milestoneOrder),
          milestoneLabels: shareSnapshot(milestoneLabels),
          result,
          pnl,
          nilaiPenawaran,
          meetingCounts: counts[id],
          milestones: Object.fromEntries(
            Object.entries(milestones).filter(([, date]) => date != null),
          ),
        }),
      )}
      catalog={[...(catalog.upstream ?? []), ...(catalog.downstream ?? [])]}
      anchor={todayISO()}
      isAdmin={ctx.profile.role === "admin"}
    />
  );
}
