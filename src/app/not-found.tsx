import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import styles from "@/components/Workspace.module.css";
export default function NotFound() {
  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow="PAGE NOT FOUND"
        title="This page is not available."
        description="The link may have changed, or the record may no longer be available."
      />
      <Button asChild variant="default">
        <Link href="/tenders">Browse tenders</Link>
      </Button>
    </div>
  );
}
