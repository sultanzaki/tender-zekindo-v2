import { requireUser } from "@/lib/auth/dal";
import { getAllTenders } from "@/lib/tenders";
import { getMilestoneCatalog } from "@/lib/milestones";
import { todayISO } from "@/lib/tender-logic";
import { RegisterWorkspace } from "@/components/RegisterWorkspace";

export const dynamic = "force-dynamic";

export default async function TenderTablePage() {
  const ctx = await requireUser();
  const [rows, catalog] = await Promise.all([
    getAllTenders(),
    getMilestoneCatalog(),
  ]);
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
          milestoneOrder,
          result,
          pnl,
          nilaiPenawaran,
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
