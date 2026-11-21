import { requireAdmin } from "@/lib/auth/dal";
import { getTenderFormChoices } from "@/lib/tenders";
import { getMilestoneTypes } from "@/lib/milestones";
import { NewTenderForm } from "@/components/NewTenderForm";
import { trackFromParam } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewTenderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  // The form is reached from the list of one track, so it OPENS on that track —
  // but it no longer fixes it: the form has its own picker. Creating is the only
  // moment a track is chosen; after that it never changes.
  const initialTrack = trackFromParam(sp.track);
  // Both catalogs, so the picker can swap the milestone list without a round
  // trip and without losing anything already typed. Tender numbers from both
  // tracks are offered, so a number reused across tracks is still caught.
  const [choices, upstreamCatalog, downstreamCatalog] = await Promise.all([
    getTenderFormChoices("all"),
    getMilestoneTypes("upstream"),
    getMilestoneTypes("downstream"),
  ]);
  return (
    <NewTenderForm
      initialTrack={initialTrack}
      selectOptions={choices.selectOptions}
      catalogs={{ upstream: upstreamCatalog, downstream: downstreamCatalog }}
      existingTenders={choices.existingTenders}
    />
  );
}
