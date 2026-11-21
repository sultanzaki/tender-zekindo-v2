import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { getTenderFormChoices, getTenderById } from "@/lib/tenders";
import { getMilestoneTypes } from "@/lib/milestones";
import { EditTenderForm } from "@/components/EditTenderForm";

export const dynamic = "force-dynamic";

export default async function EditTenderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  await requireAdmin();
  const [{ id }, { section }] = await Promise.all([params, searchParams]);
  const tender = await getTenderById(id);
  if (!tender) notFound();

  // The catalog comes from the tender's own track, and the sibling suggestions
  // are limited to it too: an upstream tender must not offer a downstream
  // tender's number, and the milestones shown must be its own.
  const [{ selectOptions, existingTenders }, milestoneTypes] =
    await Promise.all([
      getTenderFormChoices(tender.track),
      getMilestoneTypes(tender.track),
    ]);
  return (
    <EditTenderForm
      tender={tender}
      startOnMilestones={section === "milestones"}
      selectOptions={selectOptions}
      milestoneTypes={milestoneTypes}
      existingTenders={existingTenders}
    />
  );
}
