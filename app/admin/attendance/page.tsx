"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Loader2,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type AdminUser = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
};

type EmployeeRow = {
  id: string;
  user_id: string | null;
  erp_employee_id: string | null;
  employee_name: string;
  employee_email: string | null;
  employee_phone: string | null;
  branch_name: string;
  designation: string | null;
  allowed_latitude: number | null;
  allowed_longitude: number | null;
  allowed_radius_meters: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type SummaryState = {
  total: number;
  active: number;
  inactive: number;
  branches: string[];
};

type EmployeeForm = {
  employee_name: string;
  employee_email: string;
  employee_phone: string;
  erp_employee_id: string;
  branch_name: string;
  designation: string;
  allowed_latitude: string;
  allowed_longitude: string;
  allowed_radius_meters: string;
  notes: string;
};

const DEFAULT_SUMMARY: SummaryState = {
  total: 0,
  active: 0,
  inactive: 0,
  branches: [],
};

const DEFAULT_FORM: EmployeeForm = {
  employee_name: "",
  employee_email: "",
  employee_phone: "",
  erp_employee_id: "",
  branch_name: "",
  designation: "",
  allowed_latitude: "",
  allowed_longitude: "",
  allowed_radius_meters: "150",
  notes: "",
};

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

function locationText(employee: EmployeeRow) {
  if (employee.allowed_latitude === null || employee.allowed_longitude === null) {
    return "Location not set";
  }

  return `${employee.allowed_latitude}, ${employee.allowed_longitude}`;
}

export default function AdminAttendancePage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [accessError, setAccessError] = useState("");

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [summary, setSummary] = useState<SummaryState>(DEFAULT_SUMMARY);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState(false);

  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EmployeeForm>(DEFAULT_FORM);

  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function loadEmployees(options?: {
    searchValue?: string;
    branchValue?: string;
    activeValue?: string;
    tokenFromCheck?: string;
  }) {
    setLoadingEmployees(true);
    setErrorText("");

    const nextSearch = options?.searchValue ?? search;
    const nextBranch = options?.branchValue ?? branchFilter;
    const nextActive = options?.activeValue ?? activeFilter;

    try {
      const token = options?.tokenFromCheck || (await getAccessToken());

      if (!token) {
        router.replace("/account/login?next=/admin/attendance");
        return;
      }

      const params = new URLSearchParams();

      if (nextSearch.trim()) {
        params.set("search", nextSearch.trim());
      }

      if (nextBranch.trim()) {
        params.set("branch", nextBranch.trim());
      }

      if (nextActive !== "all") {
        params.set("active", nextActive);
      }

      const res = await fetch(`/api/admin/attendance/employees?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setAllowed(false);
        setAccessError(json?.error || "Attendance access required.");
        throw new Error(json?.error || "Failed to load employees.");
      }

      setAllowed(true);
      setEmployees(Array.isArray(json?.employees) ? json.employees : []);
      setSummary(json?.summary || DEFAULT_SUMMARY);

      if (json?.admin) {
        setAdminUser(json.admin);
        setAdminEmail(json.admin.email || "");
      }
    } catch (error: any) {
      setErrorText(error?.message || "Failed to load employees.");
      setEmployees([]);
      setSummary(DEFAULT_SUMMARY);
    } finally {
      setLoadingEmployees(false);
    }
  }

  async function createEmployee() {
    setSavingEmployee(true);
    setErrorText("");
    setSuccessText("");

    try {
      const token = await getAccessToken();

      if (!token) {
        router.replace("/account/login?next=/admin/attendance");
        return;
      }

      const res = await fetch("/api/admin/attendance/employees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employee_name: form.employee_name,
          employee_email: form.employee_email,
          employee_phone: form.employee_phone,
          erp_employee_id: form.erp_employee_id,
          branch_name: form.branch_name,
          designation: form.designation,
          allowed_latitude: form.allowed_latitude,
          allowed_longitude: form.allowed_longitude,
          allowed_radius_meters: form.allowed_radius_meters,
          notes: form.notes,
          is_active: true,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to create employee.");
      }

      setForm(DEFAULT_FORM);
      setShowForm(false);
      setSuccessText("Employee created successfully.");
      await loadEmployees({ tokenFromCheck: token });
    } catch (error: any) {
      setErrorText(error?.message || "Failed to create employee.");
    } finally {
      setSavingEmployee(false);
    }
  }

  function updateForm(key: keyof EmployeeForm, value: string) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    setErrorText("");
    setSuccessText("");
  }

  function submitSearch(nextSearch: string) {
    const cleanSearch = nextSearch.trim();
    setSearch(cleanSearch);
    loadEmployees({ searchValue: cleanSearch });
  }

  function changeBranch(nextBranch: string) {
    setBranchFilter(nextBranch);
    loadEmployees({ branchValue: nextBranch });
  }

  function changeActive(nextActive: string) {
    setActiveFilter(nextActive);
    loadEmployees({ activeValue: nextActive });
  }

  function resetFilters() {
    setSearch("");
    setBranchFilter("");
    setActiveFilter("all");

    loadEmployees({
      searchValue: "",
      branchValue: "",
      activeValue: "all",
    });
  }

  useEffect(() => {
    async function initAdmin() {
      setAuthLoading(true);

      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session?.access_token) {
        router.replace("/account/login?next=/admin/attendance");
        return;
      }

      setAdminEmail(String(session.user?.email || "").trim().toLowerCase());
      setAllowed(true);
      setAuthLoading(false);

      await loadEmployees({
        tokenFromCheck: session.access_token,
      });
    }

    initAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const stats = useMemo(
    () => [
      {
        label: "Total Employees",
        value: summary.total,
        icon: UsersRound,
        className: "border-neutral-200 bg-white text-neutral-950",
      },
      {
        label: "Active Employees",
        value: summary.active,
        icon: CheckCircle2,
        className: "border-green-200 bg-green-50 text-green-700",
      },
      {
        label: "Inactive Employees",
        value: summary.inactive,
        icon: XCircle,
        className: "border-red-200 bg-red-50 text-red-700",
      },
      {
        label: "Branches",
        value: summary.branches.length,
        icon: Building2,
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

  if (!allowed && accessError) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] border border-red-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <ShieldCheck className="h-6 w-6" />
        </div>

        <h1 className="mt-4 text-2xl font-black text-neutral-950">
          Attendance Access Required
        </h1>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          {accessError}
        </p>

        <Link
          href="/admin"
          className="mt-6 inline-flex rounded-2xl bg-[#a30105] px-5 py-3 text-sm font-bold text-white"
        >
          Back to Dashboard
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
              HR Attendance
            </p>

            <h1 className="mt-3 text-3xl font-black text-neutral-950">
              Employee Attendance
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              Employee master list foundation for branch-wise attendance,
              geo-location validation and future ERPNext attendance sync.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowForm((current) => !current)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#a30105] px-5 py-3 text-sm font-black text-white transition hover:bg-[#8f0104]"
            >
              <Plus className="h-4 w-4" />
              {showForm ? "Close Form" : "Add Employee"}
            </button>

            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
              Admin: {adminEmail}
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold uppercase text-blue-700">
              Role: {adminUser?.role || "admin"}
            </div>
          </div>
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

      {showForm ? (
        <div className="rounded-[30px] border border-[#a30105]/20 bg-[#fff7f7] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="mb-5">
            <h2 className="text-2xl font-black text-neutral-950">
              Add Employee
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              ERP Employee ID optional hai. Geo location branch ke exact point ke liay save hogi.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <input
              value={form.employee_name}
              onChange={(event) => updateForm("employee_name", event.target.value)}
              placeholder="Employee Name *"
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-[#a30105]"
            />

            <input
              value={form.branch_name}
              onChange={(event) => updateForm("branch_name", event.target.value)}
              placeholder="Branch Name *"
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-[#a30105]"
            />

            <input
              value={form.employee_email}
              onChange={(event) => updateForm("employee_email", event.target.value)}
              placeholder="Employee Email"
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-[#a30105]"
            />

            <input
              value={form.employee_phone}
              onChange={(event) => updateForm("employee_phone", event.target.value)}
              placeholder="Employee Phone"
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-[#a30105]"
            />

            <input
              value={form.erp_employee_id}
              onChange={(event) => updateForm("erp_employee_id", event.target.value)}
              placeholder="ERPNext Employee ID"
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-[#a30105]"
            />

            <input
              value={form.designation}
              onChange={(event) => updateForm("designation", event.target.value)}
              placeholder="Designation"
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-[#a30105]"
            />

            <input
              value={form.allowed_latitude}
              onChange={(event) => updateForm("allowed_latitude", event.target.value)}
              placeholder="Allowed Latitude"
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-[#a30105]"
            />

            <input
              value={form.allowed_longitude}
              onChange={(event) => updateForm("allowed_longitude", event.target.value)}
              placeholder="Allowed Longitude"
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-[#a30105]"
            />

            <input
              value={form.allowed_radius_meters}
              onChange={(event) =>
                updateForm("allowed_radius_meters", event.target.value)
              }
              placeholder="Allowed Radius Meters"
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-[#a30105]"
            />

            <textarea
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              placeholder="Notes"
              rows={3}
              className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#a30105] md:col-span-2"
            />
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={createEmployee}
              disabled={savingEmployee}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#a30105] px-6 py-3 text-sm font-black text-white transition hover:bg-[#8f0104] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingEmployee ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Save Employee
                </>
              )}
            </button>
          </div>
        </div>
      ) : null}

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
              placeholder="Search employee, branch, phone, ERP ID..."
              className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 pl-11 pr-4 text-sm font-medium outline-none transition focus:border-[#a30105] focus:bg-white"
            />
          </div>

          <select
            value={branchFilter}
            onChange={(event) => changeBranch(event.target.value)}
            className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-black text-neutral-800 outline-none focus:border-[#a30105]"
          >
            <option value="">All Branches</option>
            {summary.branches.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>

          <select
            value={activeFilter}
            onChange={(event) => changeActive(event.target.value)}
            className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-black text-neutral-800 outline-none focus:border-[#a30105]"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button
            type="submit"
            disabled={loadingEmployees}
            className="h-12 rounded-2xl bg-[#a30105] px-6 text-sm font-black text-white transition hover:bg-[#8f0104] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingEmployees ? "Loading..." : "Search"}
          </button>

          <button
            type="button"
            disabled={loadingEmployees}
            onClick={resetFilters}
            className="h-12 rounded-2xl border border-neutral-200 bg-white px-6 text-sm font-black text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reset
          </button>
        </form>

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
        {loadingEmployees ? (
          <div className="p-10 text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#a30105]" />
            <p className="mt-3 text-sm font-bold text-neutral-600">
              Loading employees...
            </p>
          </div>
        ) : employees.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
            <h2 className="text-xl font-black text-neutral-950">
              No Employees Found
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              Add employees to start attendance tracking.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs font-black uppercase tracking-wider text-neutral-500">
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Branch</th>
                  <th className="px-3 py-2">ERP Link</th>
                  <th className="px-3 py-2">Geo Location</th>
                  <th className="px-3 py-2">Radius</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Updated</th>
                </tr>
              </thead>

              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="rounded-l-2xl border-y border-l border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#a30105] shadow-sm">
                          <UserRound className="h-5 w-5" />
                        </div>

                        <div>
                          <div className="font-black text-neutral-950">
                            {employee.employee_name}
                          </div>
                          <div className="mt-1 text-xs font-bold text-neutral-500">
                            {employee.employee_phone || employee.employee_email || "No contact"}
                          </div>
                          <div className="mt-1 text-xs font-bold text-neutral-500">
                            {employee.designation || "No designation"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      <div className="font-black text-neutral-950">
                        {employee.branch_name}
                      </div>
                    </td>

                    <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      <div className="text-sm font-bold text-neutral-700">
                        {employee.erp_employee_id || "Not linked"}
                      </div>
                    </td>

                    <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      <div className="flex items-center gap-2 text-sm font-bold text-neutral-700">
                        <MapPin className="h-4 w-4 text-[#a30105]" />
                        {locationText(employee)}
                      </div>
                    </td>

                    <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      <div className="font-bold text-neutral-800">
                        {employee.allowed_radius_meters || 150}m
                      </div>
                    </td>

                    <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      {employee.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-black uppercase text-green-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black uppercase text-red-700">
                          <XCircle className="h-3.5 w-3.5" />
                          Inactive
                        </span>
                      )}
                    </td>

                    <td className="rounded-r-2xl border-y border-r border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      <div className="text-sm font-bold text-neutral-700">
                        {formatDate(employee.updated_at)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}