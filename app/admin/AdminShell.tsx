"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Store,
  UsersRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type AdminShellProps = {
  children: ReactNode;
};

type AdminNavItem = {
  label: string;
  href: string;
  icon: any;
  badge?: string;
  disabled?: boolean;
};

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
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
    label: "Users / Roles",
    href: "/admin/users",
    icon: UsersRound,
    badge: "Next",
  },
  {
    label: "Reports",
    href: "/admin/reports",
    icon: BarChart3,
    badge: "Soon",
    disabled: true,
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    badge: "Soon",
    disabled: true,
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
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
  onNavigate,
  pathname,
}: {
  onNavigate?: () => void;
  pathname: string;
}) {
  return (
    <nav className="space-y-2">
      {ADMIN_NAV_ITEMS.map((item) => {
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
                  Orders, users & reports
                </div>
              </div>
            </div>
          </div>

          <AdminNav pathname={pathname} />

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
              Admin access is protected through database roles and active account
              status checks.
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