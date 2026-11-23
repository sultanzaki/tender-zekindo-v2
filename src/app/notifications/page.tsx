import { getDeadlineQueue } from "@/lib/tenders";
import { requireUser } from "@/lib/auth/dal";
import { todayISO } from "@/lib/tender-logic";
import { DeadlineWorkspace } from "@/components/DeadlineWorkspace";
export const dynamic = "force-dynamic";
export default async function Notifications({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; track?: string }>;
}) {
  const ctx = await requireUser();
  const [queue, params] = await Promise.all([
    getDeadlineQueue(todayISO()),
    searchParams,
  ]);
  return (
    <DeadlineWorkspace
      isAdmin={ctx.profile.role === "admin"}
      {...queue}
      initialView={params.view}
      initialTrack={params.track}
    />
  );
}
