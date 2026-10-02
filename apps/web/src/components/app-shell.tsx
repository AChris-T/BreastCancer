"use client";

import type { NotificationView } from "@breastscan/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CloudUpload,
  FileClock,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Share2,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn, relativeTime } from "@/lib/utils";
import { Logo } from "./brand";
import { Spinner } from "./ui/card";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const PATIENT_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "New case", icon: CloudUpload },
  { href: "/history", label: "Cases", icon: FileClock },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/shares", label: "Shared links", icon: Share2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const PATIENT_TABS = ["/dashboard", "/upload", "/history", "/reports"];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Signed-in layout: fixed sidebar on desktop, bottom tab bar on mobile.
 * Signed-out visitors are sent to sign in. Navigation is hidden when printing.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // The menu belongs to the page it was opened on, so navigating closes it.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const menuOpen = menuFor === pathname;
  const setMenuOpen = (open: boolean) => setMenuFor(open ? pathname : null);

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  if (status !== "authenticated" || !user) return <Spinner label="Loading your account" className="min-h-dvh" />;

  const nav = PATIENT_NAV;
  const tabs = nav.filter((n) => PATIENT_TABS.includes(n.href));

  return (
    <div className="min-h-dvh lg:pl-64 print:pl-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:p-3">
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-primary-900 text-white lg:flex print:!hidden">
        <div className="px-5 py-5">
          <Logo href="/dashboard" inverted />
        </div>
        <NavList items={nav} pathname={pathname} />
        <SidebarFooter />
      </aside>

      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur lg:px-8 print:hidden">
        <div className="lg:hidden">
          <Logo href="/dashboard" />
        </div>
        <p className="hidden text-[15px] text-text-muted lg:block">
          {`Welcome${user.lastName ? `, Dr ${user.lastName}` : ""}`}
        </p>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-lg hover:bg-primary-50 lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" aria-hidden />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-primary-900/40" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col bg-primary-900 text-white">
            <div className="flex items-center justify-between px-5 py-4">
              <span className="font-semibold">Menu</span>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="rounded p-2 hover:bg-white/10">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <NavList items={nav} pathname={pathname} />
            <SidebarFooter />
          </div>
        </div>
      )}

      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 lg:px-8 lg:py-8 print:max-w-none print:p-0">
        {children}
      </main>

      {tabs.length > 0 && (
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface lg:hidden print:hidden">
          <ul className="grid grid-cols-5">
            {tabs.map((item) => (
              <li key={item.href}>
                <TabLink item={item} active={isActive(pathname, item.href)} />
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="flex w-full flex-col items-center gap-1 py-2.5 text-[12px] font-medium text-text-muted"
              >
                <Menu className="size-5" aria-hidden />
                More
              </button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn("flex flex-col items-center gap-1 py-2.5 text-[12px] font-medium", active ? "text-primary-600" : "text-text-muted")}
    >
      <Icon className="size-5" aria-hidden />
      {item.label}
    </Link>
  );
}

function NavList({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <nav aria-label="Sections" className="flex-1 overflow-y-auto px-3">
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium focus-visible:outline-white",
                  active ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SidebarFooter() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  return (
    <div className="border-t border-white/10 p-4">
      <p className="truncate text-sm text-white/70">{user?.email}</p>
      <button
        type="button"
        onClick={async () => {
          await signOut();
          router.replace("/login");
        }}
        className="mt-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-white/90 hover:bg-white/10 focus-visible:outline-white"
      >
        <LogOut className="size-4" aria-hidden /> Sign out
      </button>
    </div>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<{ items: NotificationView[]; unread: number }>("/notifications"),
    refetchInterval: 60_000,
  });
  const markAll = useMutation({
    mutationFn: () => api("/notifications/read-all", { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = data?.unread ?? 0;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative flex size-10 items-center justify-center rounded-lg hover:bg-primary-50"
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-risk-high px-1 text-[11px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-card border border-border bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="font-semibold">Notifications</p>
            {unread > 0 && (
              <button type="button" className="text-sm font-medium text-primary-600" onClick={() => markAll.mutate()}>
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {!data?.items.length && <li className="px-4 py-6 text-center text-text-muted">No notifications yet</li>}
            {data?.items.map((n) => (
              <li key={n.id}>
                <NotificationRow n={n} onOpen={() => setOpen(false)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function NotificationRow({ n, onOpen }: { n: NotificationView; onOpen: () => void }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  return (
    <button
      type="button"
      className={cn("flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-bg", !n.readAt && "bg-primary-50/60")}
      onClick={async () => {
        if (!n.readAt) {
          await api(`/notifications/${n.id}/read`, { method: "PATCH" }).catch(() => undefined);
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
        onOpen();
        if (n.link) router.push(n.link);
      }}
    >
      <span className={cn("text-[15px]", !n.readAt && "font-semibold")}>{n.title}</span>
      <span className="text-sm text-text-muted">{n.body}</span>
      <span className="text-[12px] text-text-muted">{relativeTime(n.createdAt)}</span>
    </button>
  );
}
