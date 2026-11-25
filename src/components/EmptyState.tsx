import Link from "next/link";
import type { ReactNode } from "react";
import { SearchX } from "lucide-react";
import { Button } from "./ui/button";

/** A centred "nothing here" panel with a way forward. */
export function EmptyState({
  title,
  description,
  icon = <SearchX aria-hidden="true" />,
  actions,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  actions: { href: string; label: string; primary?: boolean }[];
}) {
  return (
    <section className="mx-auto grid max-w-md justify-items-center gap-3 px-6 py-24 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground [&_svg]:size-7">
        {icon}
      </div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {actions.map((a) => (
          <Button key={a.href} asChild variant={a.primary ? "default" : "outline"}>
            <Link href={a.href}>{a.label}</Link>
          </Button>
        ))}
      </div>
    </section>
  );
}
