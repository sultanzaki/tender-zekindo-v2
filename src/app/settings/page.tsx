import Link from "next/link";
import { Icon } from "@/components/Icon";
import { requireAdmin } from "@/lib/auth/dal";
import { PageHeading } from "@/components/PageHeading";
import workspace from "@/components/Workspace.module.css";

const destinations = [
  {
    href: "/admin/users",
    title: "Users & access",
    description: "Manage workspace accounts and roles.",
    icon: "users",
  },
  {
    href: "/admin/milestones",
    title: "Milestone templates",
    description: "Set default stages for new Upstream and Downstream tenders.",
    icon: "milestones",
  },
  {
    href: "/admin/access-log",
    title: "Access log",
    description: "Who signed in, exported or downloaded documents, and from where.",
    icon: "shield",
  },
  {
    href: "/tenders/archive",
    title: "Archived tenders",
    description: "Review and restore archived tenders",
    icon: "archive",
  },
] as const;

export default async function Settings() {
  await requireAdmin();
  return (
    <section className={workspace.page}>
      <PageHeading
        eyebrow="ADMINISTRATION"
        title="Settings"
        description="Accounts, schedule templates, audit trail and archived records."
      />
      <ul className="grid max-w-3xl gap-1 rounded-xl border bg-card p-2">
        {destinations.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              data-slot="settings-link"
              className="flex items-center gap-4 rounded-lg px-3 py-4 transition-colors hover:bg-muted focus-visible:outline-primary"
            >
              <span className="grid size-10 flex-none place-items-center rounded-lg bg-accent text-accent-foreground">
                <Icon name={item.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm font-semibold text-foreground">{item.title}</strong>
                <span className="text-sm text-muted-foreground">
                  {item.description}
                </span>
              </span>
              <Icon name="arrow" className="text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
