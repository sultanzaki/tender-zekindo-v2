import Link from "next/link";
import styles from "./Workspace.module.css";

/** Event filter for Settings → Access log. Uses the shared segmented pills:
 * Tailwind colour utilities lose to the global (unlayered) link colour, which
 * made the active pill blue-on-blue. */
export function AccessLogFilters<A extends string>({
  actions,
  labels,
  active,
}: {
  actions: readonly A[];
  labels: Record<A, string>;
  active?: A;
}) {
  return (
    <nav aria-label="Filter by event" className={`${styles.pills} ${styles.pillsWrap}`}>
      {[undefined, ...actions].map((a) => (
        <Link
          key={a ?? "all"}
          href={a ? `/admin/access-log?action=${a}` : "/admin/access-log"}
          aria-current={a === active ? "page" : undefined}
        >
          {a ? labels[a] : "All events"}
        </Link>
      ))}
    </nav>
  );
}
