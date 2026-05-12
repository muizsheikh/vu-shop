"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  Search,
  ShieldCheck,
  UserCheck,
  UserRound,
  UsersRound,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type AdminUser = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
};

type UserRow = {
  id: string;
  email: string;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  address_line1: string | null;
  role: string;
  is_active: boolean;
  profile_updated_at: string | null;
  has_profile: boolean;
};

type SummaryState = {
  total: number;
  active: number;
  inactive: number;
  admin: number;
  manager: number;
  support: number;
  customer: number;
};

const DEFAULT_SUMMARY: SummaryState = {
  total: 0,
  active: 0,
  inactive: 0,
  admin: 0,
  manager: 0,
  support: 0,
  customer: 0,
};

const ROLE_FILTERS = [
  { key: "all", label: "All Roles" },
  { key: "admin", label: "Admin" },
  { key: "manager", label: "Manager" },
  { key: "support", label: "Support" },
  { key: "customer", label: "Customer" },
];

const EDITABLE_ROLES = [
  { key: "customer", label: "Customer" },
  { key: "support", label: "Support" },
  { key: "manager", label: "Manager" },
  { key: "admin", label: "Admin" },
];

const ACTIVE_FILTERS = [
  { key: "all", label: "All Accounts" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";

  try {
    return new Date(value).toLocaleString("en-PK", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function getRoleClasses(role: string) {
  const normalized = String(role || "customer").toLowerCase();

  if (normalized === "admin") {
    return "border-[#a30105]/20 bg-[#fff7f7] text-[#a30105]";
  }

  if (normalized === "manager") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (normalized === "support") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-neutral-200 bg-neutral-50 text-neutral-700";
}

function getRoleLabel(role: string) {
  const normalized = String(role || "customer").trim().toLowerCase();

  return normalized
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getFilterClass(active: boolean) {
  if (active) {
    return "border-[#a30105]/25 bg-[#fff7f7] text-[#a30105]";
  }

  return "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50";
}

function replaceUserInList(users: UserRow[], updatedUser: UserRow) {
  return users.map((user) => {
    if (user.id === updatedUser.id) {
      return updatedUser;
    }

    return user;
  });
}

export default function AdminUsersPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [accessError, setAccessError] = useState("");

  const [users, setUsers] = useState<UserRow[]>([]);
  const [summary, setSummary] = useState<SummaryState>(DEFAULT_SUMMARY);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [canManageUsers, setCanManageUsers] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function checkAdminAccess() {
    const token = await getAccessToken();

    if (!token) {
      router.replace("/account/login?next=/admin/users");
      return null;
    }

    const res = await fetch("/api/admin/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.allowed) {
      setAllowed(false);
      setAccessError(json?.error || "Admin access required.");
      setAdminUser(json?.user || null);
      setAdminEmail(json?.user?.email || "");
      return null;
    }

    const user = json.user as AdminUser;
    setAllowed(true);
    setAdminUser(user);
    setAdminEmail(user.email || "");

    return token;
  }

  async function loadUsers(options?: {
    searchValue?: string;
    roleValue?: string;
    activeValue?: string;
    tokenFromCheck?: string;
  }) {
    setLoadingUsers(true);
    setErrorText("");
    setSuccessText("");

    const nextSearch = options?.searchValue ?? search;
    const nextRole = options?.roleValue ?? roleFilter;
    const nextActive = options?.activeValue ?? activeFilter;

    try {
      const token = options?.tokenFromCheck || (await getAccessToken());

      if (!token) {
        router.replace("/account/login?next=/admin/users");
        return;
      }

      const params = new URLSearchParams();

      if (nextSearch.trim()) {
        params.set("search", nextSearch.trim());
      }

      if (nextRole !== "all") {
        params.set("role", nextRole);
      }

      if (nextActive !== "all") {
        params.set("active", nextActive);
      }

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load users.");
      }

      setUsers(Array.isArray(json?.users) ? json.users : []);
      setSummary(json?.summary || DEFAULT_SUMMARY);
      setCanManageUsers(Boolean(json?.can_manage_users));

      if (json?.admin) {
        setAdminUser(json.admin);
        setAdminEmail(json.admin.email || "");
      }
    } catch (error: any) {
      setErrorText(error?.message || "Failed to load users.");
      setUsers([]);
      setSummary(DEFAULT_SUMMARY);
      setCanManageUsers(false);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function updateUserAccess(
    user: UserRow,
    update: {
      role?: string;
      is_active?: boolean;
    }
  ) {
    setUpdatingUserId(user.id);
    setErrorText("");
    setSuccessText("");

    try {
      const token = await getAccessToken();

      if (!token) {
        router.replace("/account/login?next=/admin/users");
        return;
      }

      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(update),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to update user access.");
      }

      const updatedUser = json?.user as UserRow;

      if (updatedUser?.id) {
        setUsers((current) => replaceUserInList(current, updatedUser));
      }

      if (json?.admin) {
        setAdminUser(json.admin);
        setAdminEmail(json.admin.email || "");
      }

      setSuccessText("User access updated successfully.");
      await loadUsers();
    } catch (error: any) {
      setErrorText(error?.message || "Failed to update user access.");
    } finally {
      setUpdatingUserId(null);
    }
  }

  function submitSearch(nextSearch: string) {
    const cleanSearch = nextSearch.trim();
    setSearch(cleanSearch);
    loadUsers({ searchValue: cleanSearch });
  }

  function changeRoleFilter(nextRole: string) {
    setRoleFilter(nextRole);
    loadUsers({ roleValue: nextRole });
  }

  function changeActiveFilter(nextActive: string) {
    setActiveFilter(nextActive);
    loadUsers({ activeValue: nextActive });
  }

  function resetFilters() {
    setSearch("");
    setRoleFilter("all");
    setActiveFilter("all");

    loadUsers({
      searchValue: "",
      roleValue: "all",
      activeValue: "all",
    });
  }

  useEffect(() => {
    async function initAdmin() {
      setAuthLoading(true);

      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        router.replace("/account/login?next=/admin/users");
        return;
      }

      setAdminEmail(String(user.email || "").trim().toLowerCase());

      const token = await checkAdminAccess();

      setAuthLoading(false);

      if (token) {
        await loadUsers({ tokenFromCheck: token });
      }
    }

    initAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const stats = useMemo(
    () => [
      {
        label: "Total Users",
        value: summary.total,
        icon: UsersRound,
        className: "border-neutral-200 bg-white text-neutral-950",
      },
      {
        label: "Active Accounts",
        value: summary.active,
        icon: CheckCircle2,
        className: "border-green-200 bg-green-50 text-green-700",
      },
      {
        label: "Inactive Accounts",
        value: summary.inactive,
        icon: XCircle,
        className: "border-red-200 bg-red-50 text-red-700",
      },
      {
        label: "Admin Roles",
        value: summary.admin + summary.manager + summary.support,
        icon: ShieldCheck,
        className: "border-[#a30105]/20 bg-[#fff7f7] text-[#a30105]",
      },
    ],
    [summary]
  );

  if (authLoading) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#a30105]" />
        <p className="mt-3 text-sm font-bold text-neutral-700">
          Checking admin access...
        </p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] border border-red-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <ShieldCheck className="h-6 w-6" />
        </div>

        <h1 className="mt-4 text-2xl font-black text-neutral-950">
          Admin Access Required
        </h1>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          {accessError || "This account is not allowed to access user management."}
        </p>

        <p className="mt-3 rounded-2xl bg-neutral-50 px-4 py-3 text-xs font-bold text-neutral-600">
          Logged in as: {adminEmail || "Unknown"}
        </p>

        <Link
          href="/account"
          className="mt-6 inline-flex rounded-2xl bg-[#a30105] px-5 py-3 text-sm font-bold text-white"
        >
          Back to Account
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
              Admin Panel
            </p>

            <h1 className="mt-3 text-3xl font-black text-neutral-950">
              Users & Roles
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              Manage registered customers, staff roles and account activation
              status from one secure admin screen.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
              Admin: {adminEmail}
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold uppercase text-blue-700">
              Role: {adminUser?.role || "admin"}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-black uppercase text-neutral-600">
            Users Loaded: {users.length}
          </span>

          <span className="rounded-full border border-[#a30105]/20 bg-[#fff7f7] px-4 py-2 text-xs font-black uppercase text-[#a30105]">
            Permission: {canManageUsers ? "Manage Enabled" : "Read Only"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className={`rounded-[26px] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.05)] ${stat.className}`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/75">
                <Icon className="h-5 w-5" />
              </div>

              <div className="mt-5 text-sm font-bold uppercase tracking-wider opacity-80">
                {stat.label}
              </div>

              <div className="mt-2 text-3xl font-black">{stat.value}</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-[30px] border border-neutral-200 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch(search);
          }}
          className="flex flex-col gap-3 lg:flex-row"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, phone, city or role..."
              className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 pl-11 pr-4 text-sm font-medium outline-none transition focus:border-[#a30105] focus:bg-white"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(event) => changeRoleFilter(event.target.value)}
            className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-black text-neutral-800 outline-none focus:border-[#a30105]"
          >
            {ROLE_FILTERS.map((filter) => (
              <option key={filter.key} value={filter.key}>
                {filter.label}
              </option>
            ))}
          </select>

          <select
            value={activeFilter}
            onChange={(event) => changeActiveFilter(event.target.value)}
            className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-black text-neutral-800 outline-none focus:border-[#a30105]"
          >
            {ACTIVE_FILTERS.map((filter) => (
              <option key={filter.key} value={filter.key}>
                {filter.label}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={loadingUsers}
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#a30105] px-6 text-sm font-black text-white transition hover:bg-[#8f0104] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingUsers ? "Loading..." : "Search"}
          </button>

          <button
            type="button"
            onClick={resetFilters}
            disabled={loadingUsers}
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-neutral-200 bg-white px-6 text-sm font-black text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reset
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {ROLE_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => changeRoleFilter(filter.key)}
              className={`rounded-full border px-4 py-2 text-xs font-black uppercase transition ${getFilterClass(
                roleFilter === filter.key
              )}`}
            >
              {filter.label}
            </button>
          ))}

          {ACTIVE_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => changeActiveFilter(filter.key)}
              className={`rounded-full border px-4 py-2 text-xs font-black uppercase transition ${getFilterClass(
                activeFilter === filter.key
              )}`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {successText ? (
          <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700">
            {successText}
          </div>
        ) : null}

        {errorText ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {errorText}
          </div>
        ) : null}
      </div>

      <div className="rounded-[30px] border border-neutral-200 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        {loadingUsers ? (
          <div className="p-10 text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#a30105]" />
            <p className="mt-3 text-sm font-bold text-neutral-600">
              Loading users...
            </p>
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
            <h2 className="text-xl font-black text-neutral-950">
              No Users Found
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              Try clearing the search or changing the role/account filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs font-black uppercase tracking-wider text-neutral-500">
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Contact</th>
                  <th className="px-3 py-2">City</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Last Sign In</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => {
                  const isUpdating = updatingUserId === user.id;
                  const isSelf = adminUser?.id === user.id;
                  const controlsDisabled =
                    !canManageUsers || isUpdating || (isSelf && user.role === "admin");

                  return (
                    <tr key={user.id}>
                      <td className="rounded-l-2xl border-y border-l border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#a30105] shadow-sm">
                            <UserRound className="h-5 w-5" />
                          </div>

                          <div className="min-w-0">
                            <div className="font-black text-neutral-950">
                              {user.full_name || "Unnamed User"}
                            </div>
                            <div className="mt-1 truncate text-xs font-bold text-neutral-500">
                              {user.email || "No email"}
                            </div>
                            {!user.has_profile ? (
                              <div className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase text-amber-700">
                                Missing Profile
                              </div>
                            ) : null}
                            {isSelf ? (
                              <div className="mt-2 inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase text-blue-700">
                                Current Admin
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <div className="font-bold text-neutral-950">
                          {user.phone || "No phone"}
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {user.email_confirmed_at
                            ? "Email confirmed"
                            : "Email not confirmed"}
                        </div>
                      </td>

                      <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <div className="font-bold text-neutral-950">
                          {user.city || "No city"}
                        </div>
                        <div className="mt-1 line-clamp-1 text-xs text-neutral-500">
                          {user.address_line1 || "No address"}
                        </div>
                      </td>

                      <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        {canManageUsers ? (
                          <div className="space-y-2">
                            <select
                              value={user.role}
                              disabled={controlsDisabled}
                              onChange={(event) =>
                                updateUserAccess(user, {
                                  role: event.target.value,
                                })
                              }
                              className="h-10 w-full min-w-[145px] rounded-xl border border-neutral-200 bg-white px-3 text-xs font-black uppercase text-neutral-800 outline-none focus:border-[#a30105] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {EDITABLE_ROLES.map((role) => (
                                <option key={role.key} value={role.key}>
                                  {role.label}
                                </option>
                              ))}
                            </select>

                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${getRoleClasses(
                                user.role
                              )}`}
                            >
                              {getRoleLabel(user.role)}
                            </span>
                          </div>
                        ) : (
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${getRoleClasses(
                              user.role
                            )}`}
                          >
                            {getRoleLabel(user.role)}
                          </span>
                        )}
                      </td>

                      <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        {canManageUsers ? (
                          <div className="space-y-2">
                            <button
                              type="button"
                              disabled={controlsDisabled}
                              onClick={() =>
                                updateUserAccess(user, {
                                  is_active: !user.is_active,
                                })
                              }
                              className={`inline-flex w-full min-w-[130px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-black uppercase transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                user.is_active
                                  ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                  : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                              }`}
                            >
                              {isUpdating ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : user.is_active ? (
                                <UserCheck className="h-3.5 w-3.5" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5" />
                              )}
                              {user.is_active ? "Active" : "Inactive"}
                            </button>

                            <div className="text-[10px] font-bold uppercase text-neutral-400">
                              Click to {user.is_active ? "disable" : "enable"}
                            </div>
                          </div>
                        ) : user.is_active ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-black uppercase text-green-700">
                            <UserCheck className="h-3.5 w-3.5" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black uppercase text-red-700">
                            <XCircle className="h-3.5 w-3.5" />
                            Inactive
                          </span>
                        )}
                      </td>

                      <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <div className="text-sm font-bold text-neutral-700">
                          {formatDate(user.created_at)}
                        </div>
                      </td>

                      <td className="rounded-r-2xl border-y border-r border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <div className="text-sm font-bold text-neutral-700">
                          {formatDate(user.last_sign_in_at)}
                        </div>
                        {isUpdating ? (
                          <div className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-neutral-500">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Saving...
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}