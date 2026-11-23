import Link from "next/link";
import { Icon } from "@/components/Icon";
import { requireAdmin } from "@/lib/auth/dal";

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
    href: "/tenders/archive",
    title: "Archived tenders",
    description: "Review and restore archived tenders",
    icon: "archive",
  },
] as const;

export default async function Settings() {
  await requireAdmin();
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-7 md:px-8">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">Settings</h1>
      <ul className="divide-y border-y">
        {destinations.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex items-center gap-4 rounded-sm px-2 py-5 hover:bg-muted focus-visible:outline-primary"
            >
              <Icon name={item.icon} />
              <span className="min-w-0 flex-1">
                <strong className="block text-sm">{item.title}</strong>
                <span className="text-sm text-muted-foreground">
                  {item.description}
                </span>
              </span>
              <Icon name="arrow" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
