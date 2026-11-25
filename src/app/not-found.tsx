import { EmptyState } from "@/components/EmptyState";

export default function NotFound() {
  return (
    <EmptyState
      title="Page not available"
      description="The link may have changed, or the record may no longer be available."
      actions={[
        { href: "/tenders?track=all", label: "Browse tenders", primary: true },
      ]}
    />
  );
}
