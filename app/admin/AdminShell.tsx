"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarCheck,
  ClipboardList,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Store,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  canManageSettings,
  canManageUsers,
  canViewCustomers,
  canViewReports,
  canViewUsers,
} from "@/lib/admin";

type AdminShellProps = {
  children: ReactNode;
};

type AdminUser = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
};

type AdminNavItem = {
  label: string;
  href: string;
  icon: any;
  badge?: string;
  disabled?: boolean;
  hidden?: boolean;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  if (href === "/admin/attendance") {
    return pathname === "/admin/attendance";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getNavClass(active: boolean, disabled?: boolean) {
  if (disabled) {
    return "cursor-not-allowed border border-transparent bg-white/50 text-neutral-400";
  }

  if (active) {
    return "border border-[#a30105]/20 bg-[#fff7f7] text-[#a30105] shadow-sm";
  }

  return "border border-transparent text-neutral-700 hover:border-neutral-200 hover:bg-neutral-50 hover:text-neutral-950";
}

function AdminNav({
  items,
  onNavigate,
  pathname,
}: {
  items: AdminNavItem[];
  onNavigate?: () => void;
  pathname: string;
}) {
  const visibleItems = items.filter((item) => !item.hidden);

  return (
    <nav className="space-y-2">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const active = isActivePath(pathname, item.href);
        const className = `flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-black transition ${getNavClass(
          active,
          item.disabled
        )}`;

        const inner = (
          <>
            <span className="flex min-w-0 items-center gap-3">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  active
                    ? "bg-[#a30105] text-white"
                    : item.disabled
                    ? "bg-neutral-100 text-neutral-400"
                    : "bg-neutral-100 text-neutral-700"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>

              <span className="truncate">{item.label}</span>
            </span>

            {item.badge ? (
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                  active
                    ? "bg-white text-[#a30105]"
                    : item.disabled
                    ? "bg-neutral-100 text-neutral-400"
                    : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {item.badge}
              </span>
            ) : null}
          </>
        );

        if (item.disabled) {
          return (
            <button
              key={item.href}
              type="button"
              disabled
              className={className}
            >
              {inner}
            </button>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={className}
          >
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  const adminRole = adminUser?.role || "support";

  const navItems = useMemo<AdminNavItem[]>(() => {
    const userCanViewUsers = canViewUsers(adminRole);
    const userCanManageUsers = canManageUsers(adminRole);
    const userCanViewCustomers = canViewCustomers(adminRole);
    const userCanViewReports = canViewReports(adminRole);
    const userCanManageSettings = canManageSettings(adminRole);

    return [
      {
        label: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
      },
      {
        label: "Orders",
        href: "/admin/orders",
        icon: ClipboardList,
      },
      {
        label: "Customers",
        href: "/admin/customers",
        icon: UserRound,
        badge: "CRM",
        hidden: !userCanViewCustomers,
      },
      {
        label: "Attendance",
        href: "/admin/attendance",
        icon: CalendarCheck,
        badge: "HR",
        hidden: !userCanViewReports,
      },
      {
        label: "Attendance Reports",
        href: "/admin/attendance/reports",
        icon: BarChart3,
        badge: "Reports",
        hidden: !userCanViewReports,
      },
      {
        label: "Users / Roles",
        href: "/admin/users",
        icon: UsersRound,
        badge: userCanManageUsers ? "Manage" : "View",
        hidden: !userCanViewUsers,
      },
      {
        label: "Reports",
        href: "/admin/reports",
        icon: BarChart3,
        badge: "Reports",
        disabled: false,
        hidden: !userCanViewReports,
      },
      {
        label: "Settings",
        href: "/admin/settings",
        icon: Settings,
        badge: "Manage",
        disabled: false,
        hidden: !userCanManageSettings,
      },
    ];
  }, [adminRole]);

  async function loadAdminUser() {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) return;

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8000);

      const res = await fetch("/api/admin/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      window.clearTimeout(timeout);

      const json = await res.json().catch(() => null);

      if (res.ok && json?.allowed && json?.user) {
        setAdminUser(json.user);
      }
    } catch {
      // Sidebar permissions are non-blocking. Page-level APIs still enforce security.
    }
  }

  useEffect(() => {
    loadAdminUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    setSigningOut(true);

    try {
      await supabase.auth.signOut();
      router.replace("/account/login?next=/admin");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8]">
      <div className="border-b border-neutral-200 bg-white/90 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#a30105] text-white shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </span>

            <span>
              <span className="block text-sm font-black text-neutral-950">
                Vape Ustad Admin
              </span>
              <span className="block text-xs font-bold text-neutral-500">
                Operations Panel
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-neutral-950 shadow-sm"
            aria-label="Open admin menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close admin menu overlay"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />

          <aside className="absolute left-0 top-0 h-full w-[86%] max-w-sm overflow-y-auto border-r border-neutral-200 bg-white p-4 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <Link
                href="/admin"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#a30105] text-white shadow-sm">
                  <ShieldCheck className="h-5 w-5" />
                </span>

                <span>
                  <span className="block text-sm font-black text-neutral-950">
                    Vape Ustad
                  </span>
                  <span className="block text-xs font-bold text-neutral-500">
                    Admin Panel
                  </span>
                </span>
              </Link>

              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-neutral-950"
                aria-label="Close admin menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <AdminNav
              items={navItems}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />

            <div className="mt-5 space-y-2 border-t border-neutral-200 pt-5">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-black text-neutral-800 transition hover:bg-neutral-50"
              >
                <Store className="h-4 w-4" />
                Back to Shop
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                disabled={signingOut}
                className="flex w-full items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                {signingOut ? "Signing out..." : "Logout"}
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-5 lg:px-6 lg:py-6">
        <aside className="sticky top-6 hidden h-[calc(100vh-48px)] w-72 shrink-0 overflow-y-auto rounded-[30px] border border-neutral-200 bg-white p-4 shadow-[0_20px_70px_rgba(0,0,0,0.06)] lg:block">
          <Link href="/admin" className="mb-6 flex items-center gap-3">
            <span className="flex h-13 w-13 items-center justify-center rounded-[22px] bg-[#a30105] p-3 text-white shadow-sm">
              <ShieldCheck className="h-6 w-6" />
            </span>

            <span>
              <span className="block text-base font-black text-neutral-950">
                Vape Ustad
              </span>
              <span className="block text-xs font-bold uppercase tracking-[0.18em] text-[#a30105]">
                Admin Panel
              </span>
            </span>
          </Link>

          <div className="mb-5 rounded-[24px] border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#a30105] shadow-sm">
                <Home className="h-5 w-5" />
              </div>

              <div>
                <div className="text-sm font-black text-neutral-950">
                  Operations
                </div>
                <div className="text-xs font-bold text-neutral-500">
                  Orders, customers & reports
                </div>
              </div>
            </div>

            {adminUser ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase text-blue-700">
                  {adminUser.role}
                </span>
                <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[10px] font-black uppercase text-green-700">
                  Active
                </span>
              </div>
            ) : null}
          </div>

          <AdminNav items={navItems} pathname={pathname} />

          <div className="mt-5 space-y-2 border-t border-neutral-200 pt-5">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-black text-neutral-800 transition hover:bg-neutral-50"
            >
              <Store className="h-4 w-4" />
              Back to Shop
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              className="flex w-full items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {signingOut ? "Signing out..." : "Logout"}
            </button>
          </div>

          <div className="mt-5 rounded-[24px] border border-[#a30105]/15 bg-[#fff7f7] p-4">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-[#a30105]">
              Secure Area
            </div>
            <p className="mt-2 text-xs font-bold leading-5 text-neutral-600">
              Admin access is protected through database roles, active account
              status and centralized permission checks.
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="min-h-[calc(100vh-112px)]">{children}</div>
        </main>
      </div>
    </div>
  );
}