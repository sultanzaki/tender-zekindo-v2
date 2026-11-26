"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { logout } from "@/lib/auth/actions";
import type { Profile } from "@/lib/types";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import {
  Sidebar,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "./ui/sidebar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { canViewFinancials, ROLE_LABELS } from "@/lib/roles";
import { IdleLogout } from "./IdleLogout";
const pages = [
  { href: "/tenders", label: "Tenders", icon: "tenders" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/analytics", label: "Analytics", icon: "analytics" },
  { href: "/notifications", label: "Deadlines", icon: "notifications" },
] as const;
const settings = {
  href: "/settings",
  label: "Settings",
  icon: "settings",
} as const;
function CreateLink() {
  const params = useSearchParams();
  return (
    <Button asChild>
      <Link
        prefetch={true}
        href={
          params.get("track") === "downstream"
            ? "/tenders/new?track=downstream"
            : "/tenders/new"
        }
      >
        <Icon name="plus" />
        New tender
      </Link>
    </Button>
  );
}
const SUBPAGES: [RegExp, string][] = [
  [/^\/settings\/security/, "Account security"],
  [/^\/admin\/users/, "Users & access"],
  [/^\/admin\/milestones/, "Milestone templates"],
  [/^\/admin\/access-log/, "Access log"],
  [/^\/admin\/retention/, "Data retention"],
  [/^\/tenders\/archive/, "Archived tenders"],
  [/^\/tenders\/new/, "New tender"],
  [/^\/tenders\/[^/]+\/edit/, "Edit tender"],
  [/^\/tenders\/[^/]+\/meetings/, "Meetings"],
  [/^\/tenders\/(?!export)[^/]+$/, "Tender detail"],
];

/** Workspace / Section / Page. Crumbs carry data-slot so the global blue
 * link colour does not apply; only the last crumb is the current page. */
function Breadcrumbs({
  path,
  section,
}: {
  path: string;
  section: { href: string; label: string } | null;
}) {
  const sub = SUBPAGES.find(([re]) => re.test(path))?.[1];
  const sectionHref = section?.href === "/tenders" ? "/tenders?track=all" : section?.href;
  const crumb = "text-muted-foreground transition-colors hover:text-foreground";
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
      <ol className="flex min-w-0 items-center gap-2 text-sm">
        <li className="text-muted-foreground">Workspace</li>
        {section && (
          <>
            <li aria-hidden="true" className="text-muted-foreground/60">/</li>
            <li>
              {sub ? (
                <Link data-slot="breadcrumb-link" href={sectionHref!} className={crumb}>
                  {section.label}
                </Link>
              ) : (
                <span aria-current="page" className="font-medium">{section.label}</span>
              )}
            </li>
          </>
        )}
        {sub && (
          <>
            <li aria-hidden="true" className="text-muted-foreground/60">/</li>
            <li aria-current="page" className="truncate font-medium">{sub}</li>
          </>
        )}
      </ol>
    </nav>
  );
}

type NavigationProps = {
  profile: Profile | null;
  defaultSidebarOpen?: boolean;
  children?: React.ReactNode;
};
export function TopNav(props: NavigationProps) {
  const path = usePathname();
  if (!props.profile || path === "/login") return <>{props.children}</>;
  return (
    <SidebarProvider defaultOpen={props.defaultSidebarOpen}>
      <Workspace {...props} profile={props.profile} />
    </SidebarProvider>
  );
}

function Workspace({
  profile,
  children,
}: NavigationProps & { profile: Profile }) {
  const path = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);
  const { setOpenMobile } = useSidebar();
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (
        event.key !== "/" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        document.querySelector('[role="dialog"]')
      )
        return;
      if (
        (event.target as HTMLElement)?.closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      const target =
        document.querySelector<HTMLInputElement>(
          '#main-content input[type="search"]',
        ) ?? search.current;
      if (target) {
        event.preventDefault();
        target.focus();
      }
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  const isAdmin = profile.role === "admin";
  const isSettings =
    path === "/settings" ||
    path.startsWith("/admin/") ||
    path === "/tenders/archive";
  const current = isSettings
    ? settings
    : pages.find((p) => path.startsWith(p.href));
  function menu(items: readonly ((typeof pages)[number] | typeof settings)[]) {
    return (
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={current?.href === item.href}
              tooltip={item.label}
            >
              <Link
                href={
                  item.href === "/tenders"
                    ? "/tenders?track=all"
                    : item.href
                }
                aria-current={current?.href === item.href ? "page" : undefined}
                onClick={() => setOpenMobile(false)}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    );
  }
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Sidebar variant="inset" collapsible="offcanvas">
        <SidebarHeader className="px-5 pt-6 pb-4">
          <Link
            href="/"
            aria-label="Zekindo workspace"
            onClick={() => setOpenMobile(false)}
          >
            <Image
              src="/logo.png"
              alt="Zekindo"
              width={106}
              height={36}
              priority
            />
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <nav aria-label="Main navigation">
              {menu([
                ...pages.filter(
                  (p) =>
                    p.href !== "/analytics" ||
                    canViewFinancials(profile.role),
                ),
                ...(isAdmin ? [settings] : []),
              ])}
            </nav>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <Separator />
          <SidebarMenuButton size="lg" onClick={() => setAccountOpen(true)}>
            <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              {profile.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="grid text-left">
              <strong>{profile.name}</strong>
              <small>{ROLE_LABELS[profile.role]}</small>
            </span>
          </SidebarMenuButton>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="flex min-h-14 items-center gap-3 border-b px-4 md:px-6">
          <SidebarTrigger aria-label="Toggle navigation" />
          <Separator orientation="vertical" className="my-auto h-5!" />
          <Link href="/" className="md:hidden">
            <Image src="/logo.png" width={69} height={24} alt="Zekindo" />
          </Link>
          <Breadcrumbs
            path={path}
            section={current ?? null}
          />
          {path !== "/tenders" && (
            <form
              action="/tenders"
              role="search"
              className="ml-auto hidden md:block"
            >
              <input type="hidden" name="track" value="all" />
              <Input
                ref={search}
                name="search"
                aria-label="Search workspace"
                placeholder="Search tenders…"
                className="h-8 w-48"
              />
            </form>
          )}
          {isAdmin && path !== "/tenders" && path !== "/tenders/new" && (
            <div className="hidden md:block">
              <Suspense>
                <CreateLink />
              </Suspense>
            </div>
          )}
          <Button
            className="ml-auto md:hidden"
            variant="ghost"
            size="icon"
            aria-label="Account"
            onClick={() => setAccountOpen(true)}
          >
            <Icon name="account" />
          </Button>
        </header>
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
      </SidebarInset>
      <IdleLogout />
      <Modal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        title={profile.name}
      >
        <p className="text-sm text-muted-foreground">{profile.email}</p>
        <nav aria-label="Account actions" className="grid gap-2">
          <Button asChild variant="outline">
            <Link href="/settings/security" onClick={() => setAccountOpen(false)}>
              Account security
            </Link>
          </Button>
          <form action={logout}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </nav>
      </Modal>
    </>
  );
}
