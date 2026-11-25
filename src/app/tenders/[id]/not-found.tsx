import { EmptyState } from "@/components/EmptyState";

export default function TenderNotFound() {
  return (
    <EmptyState
      title="Tender not found"
      description="It may have been archived or deleted, or the link may be incomplete. Archived tenders are listed in Settings for administrators."
      actions={[
        { href: "/tenders?track=all", label: "Back to tenders", primary: true },
        { href: "/calendar", label: "Open calendar" },
      ]}
    />
  );
}
