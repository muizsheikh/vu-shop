"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type DateFilter = "today" | "yesterday" | "last_7_days" | "last_30_days" | "all_time";

type PhotoPreview = {
  url: string;
  title: string;
  employeeName: string;
  branchName: string;
  attendanceDate: string;
  timeText: string;
  photoType: "Check-in" | "Check-out";
};

type AdminUser = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
};

type EmployeeMasterRow = {
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

type AttendanceEmployee = {
  id: string;
  employee_name: string | null;
  employee_email: string | null;
  employee_phone: string | null;
  branch_name: string | null;
  designation: string | null;
  erp_employee_id: string | null;
  allowed_radius_meters: number | null;
};

type AttendanceLog = {
  id: string;
  employee_id: string;
  user_id: string | null;
  attendance_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_distance_meters: number | null;
  check_out_distance_meters: number | null;
  check_in_within_radius: boolean | null;
  check_out_within_radius: boolean | null;
  check_in_photo_url?: string | null;
  check_out_photo_url?: string | null;
  detected_branch_name?: string | null;
  branch_distance_meters?: number | null;
  branch_within_radius?: boolean | null;
  status: string | null;
  branch_name: string | null;
  device_info: string | null;
  ip_address: string | null;
  erp_sync_status: string | null;
  erp_attendance_id: string | null;
  erp_error: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  admin_employees: AttendanceEmployee | AttendanceEmployee[] | null;
};

type LogsSummaryState = {
  total: number;
  checked_in: number;
  checked_out: number;
  open: number;
  outside_radius: number;
  erp_pending: number;
  erp_synced: number;
  branches: string[];
  with_check_in_photo?: number;
  with_check_out_photo?: number;
};

type EmployeeReportRow = {
  employee_id: string;
  employee_name: string;
  employee_phone: string;
  employee_email: string;
  designation: string;
  home_branch: string;
  present_days: number;
  completed_days: number;
  open_days: number;
  outside_radius: number;
  shifted_branch_days: number;
  missing_check_in_photo: number;
  missing_check_out_photo: number;
  last_attendance_date: string;
};

type BranchReportRow = {
  branch_name: string;
  logs: number;
  employees: number;
  completed: number;
  open: number;
  outside_radius: number;
  shifted_branch: number;
};

type AttendanceStatusRow = {
  employee_id: string;
  employee_name: string;
  employee_phone: string;
  employee_email: string;
  designation: string;
  home_branch: string;
  status: "Absent" | "Present" | "Open" | "Complete";
  check_in_at: string;
  check_out_at: string;
  detected_branch: string;
  outside_radius: boolean;
  shifted_branch: boolean;
  has_check_in_photo: boolean;
  has_check_out_photo: boolean;
};

const DATE_FILTERS: { key: DateFilter; label: string; helper: string }[] = [
  { key: "today", label: "Today", helper: "Aaj ki attendance" },
  { key: "yesterday", label: "Yesterday", helper: "Kal ki attendance" },
  { key: "last_7_days", label: "Last 7 Days", helper: "Weekly review" },
  { key: "last_30_days", label: "Last 30 Days", helper: "Monthly review" },
  { key: "all_time", label: "All Time", helper: "Complete data" },
];

const DEFAULT_LOGS_SUMMARY: LogsSummaryState = {
  total: 0,
  checked_in: 0,
  checked_out: 0,
  open: 0,
  outside_radius: 0,
  erp_pending: 0,
  erp_synced: 0,
  branches: [],
  with_check_in_photo: 0,
  with_check_out_photo: 0,
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

function formatOnlyDate(value: string | null | undefined) {
  if (!value) return "Not available";

  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString("en-PK", {
      dateStyle: "medium",
    });
  } catch {
    return value;
  }
}

function csvSafe(value: unknown) {
  const text = String(value ?? "").replace(/\r?\n/g, " ").trim();
  if (text.includes(",") || text.includes('"')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function getEmployeeFromLog(log: AttendanceLog) {
  if (Array.isArray(log.admin_employees)) {
    return log.admin_employees[0] || null;
  }

  return log.admin_employees || null;
}

function getDetectedBranch(log: AttendanceLog) {
  const employee = getEmployeeFromLog(log);
  return log.detected_branch_name || log.branch_name || employee?.branch_name || "No branch";
}

function isOutsideRadius(log: AttendanceLog) {
  return (
    log.branch_within_radius === false ||
    log.check_in_within_radius === false ||
    log.check_out_within_radius === false
  );
}

function isShiftedBranch(log: AttendanceLog) {
  const employee = getEmployeeFromLog(log);
  const homeBranch = String(employee?.branch_name || "").trim().toLowerCase();
  const detectedBranch = String(getDetectedBranch(log) || "").trim().toLowerCase();

  return Boolean(homeBranch && detectedBranch && homeBranch !== detectedBranch);
}

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function statCardClass(className: string) {
  return `rounded-[26px] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.05)] ${className}`;
}

export default function AttendanceReportsPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [accessError, setAccessError] = useState("");

  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [logsSummary, setLogsSummary] = useState<LogsSummaryState>(DEFAULT_LOGS_SUMMARY);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activeEmployees, setActiveEmployees] = useState<EmployeeMasterRow[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("last_30_days");
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [errorText, setErrorText] = useState("");
  const [photoPreview, setPhotoPreview] = useState<PhotoPreview | null>(null);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  function openPhotoPreview(options: {
    url: string;
    photoType: "Check-in" | "Check-out";
    employeeName: string;
    branchName: string;
    attendanceDate: string;
    timeText: string;
  }) {
    setPhotoPreview({
      url: options.url,
      title: `${options.photoType} Photo`,
      employeeName: options.employeeName || "Employee",
      branchName: options.branchName || "No branch",
      attendanceDate: options.attendanceDate || "Not available",
      timeText: options.timeText || "Not available",
      photoType: options.photoType,
    });
  }

  function closePhotoPreview() {
    setPhotoPreview(null);
  }

  async function loadEmployees(options?: {
    searchValue?: string;
    branchValue?: string;
    tokenFromCheck?: string;
  }) {
    setLoadingEmployees(true);

    const nextSearch = options?.searchValue ?? search;
    const nextBranch = options?.branchValue ?? branchFilter;

    try {
      const token = options?.tokenFromCheck || (await getAccessToken());

      if (!token) {
        router.replace("/account/login?next=/admin/attendance/reports");
        return;
      }

      const params = new URLSearchParams();
      params.set("active", "active");
      if (nextSearch.trim()) params.set("search", nextSearch.trim());
      if (nextBranch.trim()) params.set("branch", nextBranch.trim());

      const res = await fetch(`/api/admin/attendance/employees?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load active employees.");
      }

      setActiveEmployees(Array.isArray(json?.employees) ? json.employees : []);

      if (json?.admin) {
        setAdminUser(json.admin);
        setAdminEmail(json.admin.email || "");
      }
    } catch (error: any) {
      setErrorText(error?.message || "Failed to load active employees.");
      setActiveEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  }

  async function loadReports(options?: {
    searchValue?: string;
    branchValue?: string;
    dateValue?: DateFilter;
    tokenFromCheck?: string;
  }) {
    setLoadingLogs(true);
    setErrorText("");

    const nextSearch = options?.searchValue ?? search;
    const nextBranch = options?.branchValue ?? branchFilter;
    const nextDate = options?.dateValue ?? dateFilter;

    try {
      const token = options?.tokenFromCheck || (await getAccessToken());

      if (!token) {
        router.replace("/account/login?next=/admin/attendance/reports");
        return;
      }

      const params = new URLSearchParams();
      params.set("date", nextDate);
      if (nextSearch.trim()) params.set("search", nextSearch.trim());
      if (nextBranch.trim()) params.set("branch", nextBranch.trim());

      const res = await fetch(`/api/admin/attendance/logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setAllowed(false);
        setAccessError(json?.error || "Attendance reports access required.");
        throw new Error(json?.error || "Failed to load attendance reports.");
      }

      setAllowed(true);
      setLogs(Array.isArray(json?.logs) ? json.logs : []);
      setLogsSummary(json?.summary || DEFAULT_LOGS_SUMMARY);

      if (json?.admin) {
        setAdminUser(json.admin);
        setAdminEmail(json.admin.email || "");
      }
    } catch (error: any) {
      setErrorText(error?.message || "Failed to load attendance reports.");
      setLogs([]);
      setLogsSummary(DEFAULT_LOGS_SUMMARY);
    } finally {
      setLoadingLogs(false);
    }
  }

  function changeDate(nextDate: DateFilter) {
    setDateFilter(nextDate);
    loadReports({ dateValue: nextDate });
  }

  function changeBranch(nextBranch: string) {
    setBranchFilter(nextBranch);
    loadReports({ branchValue: nextBranch });
    loadEmployees({ branchValue: nextBranch });
  }

  function submitSearch(nextSearch: string) {
    const cleanSearch = nextSearch.trim();
    setSearch(cleanSearch);
    loadReports({ searchValue: cleanSearch });
    loadEmployees({ searchValue: cleanSearch });
  }

  function resetFilters() {
    setSearch("");
    setBranchFilter("");
    setDateFilter("last_30_days");
    loadReports({ searchValue: "", branchValue: "", dateValue: "last_30_days" });
    loadEmployees({ searchValue: "", branchValue: "" });
  }

  useEffect(() => {
    async function initReports() {
      setAuthLoading(true);

      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session?.access_token) {
        router.replace("/account/login?next=/admin/attendance/reports");
        return;
      }

      setAdminEmail(String(session.user?.email || "").trim().toLowerCase());
      setAllowed(true);
      setAuthLoading(false);

      await Promise.all([
        loadReports({ tokenFromCheck: session.access_token }),
        loadEmployees({ tokenFromCheck: session.access_token }),
      ]);
    }

    initReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const branchOptions = useMemo(() => {
    return Array.from(
      new Set(
        [
          ...logsSummary.branches,
          ...logs.map((log) => getDetectedBranch(log)),
          ...logs.map((log) => getEmployeeFromLog(log)?.branch_name || ""),
          ...activeEmployees.map((employee) => employee.branch_name || ""),
        ]
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [activeEmployees, logs, logsSummary.branches]);

  const attendanceStatusRows = useMemo<AttendanceStatusRow[]>(() => {
    const logsByEmployee = new Map<string, AttendanceLog[]>();

    logs.forEach((log) => {
      const existing = logsByEmployee.get(log.employee_id) || [];
      existing.push(log);
      logsByEmployee.set(log.employee_id, existing);
    });

    return activeEmployees
      .map((employee) => {
        const employeeLogs = logsByEmployee.get(employee.id) || [];
        const latestLog = employeeLogs[0] || null;
        const completeLog = employeeLogs.find((log) => Boolean(log.check_in_at && log.check_out_at));
        const openLog = employeeLogs.find((log) => Boolean(log.check_in_at && !log.check_out_at));
        const status: AttendanceStatusRow["status"] = !latestLog
          ? "Absent"
          : openLog
          ? "Open"
          : completeLog
          ? "Complete"
          : "Present";
        const sourceLog = openLog || completeLog || latestLog;

        return {
          employee_id: employee.id,
          employee_name: employee.employee_name || "Employee",
          employee_phone: employee.employee_phone || "",
          employee_email: employee.employee_email || "",
          designation: employee.designation || "",
          home_branch: employee.branch_name || "No branch",
          status,
          check_in_at: sourceLog?.check_in_at || "",
          check_out_at: sourceLog?.check_out_at || "",
          detected_branch: sourceLog ? getDetectedBranch(sourceLog) : "",
          outside_radius: sourceLog ? isOutsideRadius(sourceLog) : false,
          shifted_branch: sourceLog ? isShiftedBranch(sourceLog) : false,
          has_check_in_photo: Boolean(sourceLog?.check_in_photo_url),
          has_check_out_photo: Boolean(sourceLog?.check_out_photo_url),
        };
      })
      .sort((a, b) => {
        const order = { Open: 0, Absent: 1, Present: 2, Complete: 3 };
        return order[a.status] - order[b.status] || a.employee_name.localeCompare(b.employee_name);
      });
  }, [activeEmployees, logs]);

  const absentRows = useMemo(
    () => attendanceStatusRows.filter((row) => row.status === "Absent"),
    [attendanceStatusRows]
  );

  const employeeRows = useMemo<EmployeeReportRow[]>(() => {
    const map = new Map<string, EmployeeReportRow>();

    logs.forEach((log) => {
      const employee = getEmployeeFromLog(log);
      const employeeId = employee?.id || log.employee_id;
      const row =
        map.get(employeeId) ||
        {
          employee_id: employeeId,
          employee_name: employee?.employee_name || "Employee",
          employee_phone: employee?.employee_phone || "",
          employee_email: employee?.employee_email || "",
          designation: employee?.designation || "",
          home_branch: employee?.branch_name || log.branch_name || "",
          present_days: 0,
          completed_days: 0,
          open_days: 0,
          outside_radius: 0,
          shifted_branch_days: 0,
          missing_check_in_photo: 0,
          missing_check_out_photo: 0,
          last_attendance_date: log.attendance_date,
        };

      row.present_days += log.check_in_at ? 1 : 0;
      row.completed_days += log.check_in_at && log.check_out_at ? 1 : 0;
      row.open_days += log.check_in_at && !log.check_out_at ? 1 : 0;
      row.outside_radius += isOutsideRadius(log) ? 1 : 0;
      row.shifted_branch_days += isShiftedBranch(log) ? 1 : 0;
      row.missing_check_in_photo += log.check_in_at && !log.check_in_photo_url ? 1 : 0;
      row.missing_check_out_photo += log.check_out_at && !log.check_out_photo_url ? 1 : 0;

      if (String(log.attendance_date || "") > String(row.last_attendance_date || "")) {
        row.last_attendance_date = log.attendance_date;
      }

      map.set(employeeId, row);
    });

    return Array.from(map.values()).sort((a, b) => a.employee_name.localeCompare(b.employee_name));
  }, [logs]);

  const branchRows = useMemo<BranchReportRow[]>(() => {
    const map = new Map<string, BranchReportRow & { employeeIds: Set<string> }>();

    logs.forEach((log) => {
      const branchName = getDetectedBranch(log);
      const current =
        map.get(branchName) ||
        {
          branch_name: branchName,
          logs: 0,
          employees: 0,
          completed: 0,
          open: 0,
          outside_radius: 0,
          shifted_branch: 0,
          employeeIds: new Set<string>(),
        };

      current.logs += 1;
      current.employeeIds.add(log.employee_id);
      current.completed += log.check_in_at && log.check_out_at ? 1 : 0;
      current.open += log.check_in_at && !log.check_out_at ? 1 : 0;
      current.outside_radius += isOutsideRadius(log) ? 1 : 0;
      current.shifted_branch += isShiftedBranch(log) ? 1 : 0;

      map.set(branchName, current);
    });

    return Array.from(map.values())
      .map((row) => ({ ...row, employees: row.employeeIds.size }))
      .sort((a, b) => b.logs - a.logs);
  }, [logs]);

  const reportStats = useMemo(() => {
    const presentEmployees = attendanceStatusRows.filter((row) => row.status !== "Absent").length;
    const shiftedBranch = logs.filter((log) => isShiftedBranch(log)).length;
    const missingCheckout = logs.filter((log) => Boolean(log.check_in_at) && !log.check_out_at).length;

    return [
      {
        label: "Active Employees",
        value: activeEmployees.length,
        icon: UsersRound,
        className: "border-neutral-200 bg-white text-neutral-950",
      },
      {
        label: "Present Employees",
        value: presentEmployees,
        icon: CheckCircle2,
        className: "border-green-200 bg-green-50 text-green-700",
      },
      {
        label: "Absent Employees",
        value: absentRows.length,
        icon: X,
        className: "border-red-200 bg-red-50 text-red-700",
      },
      {
        label: "Complete Days",
        value: logsSummary.checked_out,
        icon: CalendarDays,
        className: "border-blue-200 bg-blue-50 text-blue-700",
      },
      {
        label: "Open / Missing Checkout",
        value: missingCheckout,
        icon: Clock3,
        className: "border-amber-200 bg-amber-50 text-amber-700",
      },
      {
        label: "Outside Radius",
        value: logsSummary.outside_radius,
        icon: AlertTriangle,
        className: "border-red-200 bg-red-50 text-red-700",
      },
      {
        label: "Shifted Branch",
        value: shiftedBranch,
        icon: Building2,
        className: "border-purple-200 bg-purple-50 text-purple-700",
      },
      {
        label: "Branches",
        value: branchRows.length,
        icon: BarChart3,
        className: "border-neutral-200 bg-white text-neutral-950",
      },
    ];
  }, [absentRows.length, activeEmployees.length, attendanceStatusRows, branchRows.length, logs, logsSummary]);

  function exportEmployeeCsv() {
    const header = [
      "Employee Name",
      "Phone",
      "Email",
      "Designation",
      "Home Branch",
      "Present Days",
      "Completed Days",
      "Open Days",
      "Outside Radius",
      "Shifted Branch Days",
      "Missing Check-in Photo",
      "Missing Check-out Photo",
      "Last Attendance Date",
    ];

    const rows = employeeRows.map((row) => [
      row.employee_name,
      row.employee_phone,
      row.employee_email,
      row.designation,
      row.home_branch,
      row.present_days,
      row.completed_days,
      row.open_days,
      row.outside_radius,
      row.shifted_branch_days,
      row.missing_check_in_photo,
      row.missing_check_out_photo,
      row.last_attendance_date,
    ]);

    const csv = [header, ...rows].map((row) => row.map(csvSafe).join(",")).join("\n");
    downloadTextFile(`attendance-employee-report-${dateFilter}.csv`, csv);
  }

  function exportStatusCsv() {
    const header = [
      "Employee Name",
      "Phone",
      "Email",
      "Designation",
      "Home Branch",
      "Status",
      "Check In",
      "Check Out",
      "Detected Branch",
      "Outside Radius",
      "Shifted Branch",
      "Check-in Photo",
      "Check-out Photo",
    ];

    const rows = attendanceStatusRows.map((row) => [
      row.employee_name,
      row.employee_phone,
      row.employee_email,
      row.designation,
      row.home_branch,
      row.status,
      row.check_in_at,
      row.check_out_at,
      row.detected_branch,
      row.outside_radius ? "Yes" : "No",
      row.shifted_branch ? "Yes" : "No",
      row.has_check_in_photo ? "Yes" : "No",
      row.has_check_out_photo ? "Yes" : "No",
    ]);

    const csv = [header, ...rows].map((row) => row.map(csvSafe).join(",")).join("\n");
    downloadTextFile(`attendance-status-report-${dateFilter}.csv`, csv);
  }

  function exportRawCsv() {
    const header = [
      "Date",
      "Employee",
      "Phone",
      "Home Branch",
      "Detected Branch",
      "Check In",
      "Check Out",
      "Open",
      "Outside Radius",
      "Shifted Branch",
      "Branch Distance",
      "Check-in Photo",
      "Check-out Photo",
      "Device",
      "IP",
    ];

    const rows = logs.map((log) => {
      const employee = getEmployeeFromLog(log);
      return [
        log.attendance_date,
        employee?.employee_name || "Employee",
        employee?.employee_phone || employee?.employee_email || "",
        employee?.branch_name || "",
        getDetectedBranch(log),
        log.check_in_at || "",
        log.check_out_at || "",
        log.check_in_at && !log.check_out_at ? "Yes" : "No",
        isOutsideRadius(log) ? "Yes" : "No",
        isShiftedBranch(log) ? "Yes" : "No",
        log.branch_distance_meters ?? "",
        log.check_in_photo_url || "",
        log.check_out_photo_url || "",
        log.device_info || "",
        log.ip_address || "",
      ];
    });

    const csv = [header, ...rows].map((row) => row.map(csvSafe).join(",")).join("\n");
    downloadTextFile(`attendance-raw-logs-${dateFilter}.csv`, csv);
  }

  if (authLoading) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#a30105]" />
        <p className="mt-3 text-sm font-bold text-neutral-700">Checking admin access...</p>
      </div>
    );
  }

  if (!allowed && accessError) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] border border-red-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-2xl font-black text-neutral-950">Reports Access Required</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-500">{accessError}</p>
        <Link href="/admin/attendance" className="mt-6 inline-flex rounded-2xl bg-[#a30105] px-5 py-3 text-sm font-bold text-white">
          Back to Attendance
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href="/admin/attendance" className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-black uppercase text-neutral-700 transition hover:bg-white">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Attendance
            </Link>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">Attendance Reports</p>
            <h1 className="mt-3 text-3xl font-black text-neutral-950">Reports Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              Daily/monthly attendance review, employee-wise summary, branch-wise summary and CSV export for salary/payroll checking.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportStatusCsv}
              disabled={attendanceStatusRows.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#a30105] px-5 py-3 text-sm font-black text-white transition hover:bg-[#8f0104] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Export Status CSV
            </button>

            <button
              type="button"
              onClick={exportEmployeeCsv}
              disabled={employeeRows.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-sm font-black text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Export Employee CSV
            </button>

            <button
              type="button"
              onClick={exportRawCsv}
              disabled={logs.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-sm font-black text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Export Raw Logs
            </button>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold uppercase text-blue-700">
              {adminUser?.role || "admin"}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {reportStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={statCardClass(stat.className)}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/75">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-5 text-xs font-black uppercase tracking-wider opacity-80">{stat.label}</div>
              <div className="mt-2 text-3xl font-black">{stat.value}</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-[30px] border border-neutral-200 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <div className="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-center">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
            <div className="flex flex-wrap gap-2">
              {DATE_FILTERS.map((filter) => {
                const active = dateFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => changeDate(filter.key)}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-[#a30105]/25 bg-[#fff7f7] text-[#a30105]"
                        : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    <span className="block text-xs font-black uppercase">{filter.label}</span>
                    <span className="mt-1 block text-[11px] font-bold opacity-70">{filter.helper}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadReports()}
            disabled={loadingLogs}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-5 text-sm font-black text-neutral-900 transition hover:bg-neutral-50 disabled:opacity-60"
          >
            {loadingLogs ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch(search);
          }}
          className="mt-4 flex flex-col gap-3 lg:flex-row"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employee, branch, phone, ERP, status..."
              className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 pl-11 pr-4 text-sm font-medium outline-none transition focus:border-[#a30105] focus:bg-white"
            />
          </div>

          <select
            value={branchFilter}
            onChange={(event) => changeBranch(event.target.value)}
            className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-black text-neutral-800 outline-none focus:border-[#a30105]"
          >
            <option value="">All Branches</option>
            {branchOptions.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={loadingLogs}
            className="h-12 rounded-2xl bg-[#a30105] px-6 text-sm font-black text-white transition hover:bg-[#8f0104] disabled:opacity-60"
          >
            {loadingLogs ? "Loading..." : "Search"}
          </button>

          <button
            type="button"
            disabled={loadingLogs}
            onClick={resetFilters}
            className="h-12 rounded-2xl border border-neutral-200 bg-white px-6 text-sm font-black text-neutral-900 transition hover:bg-neutral-50 disabled:opacity-60"
          >
            Reset
          </button>
        </form>

        {errorText ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {errorText}
          </div>
        ) : null}

        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700">
          Report loaded for: {DATE_FILTERS.find((filter) => filter.key === dateFilter)?.label || dateFilter} • Active employees: {activeEmployees.length} • Admin: {adminEmail || "Admin"}
        </div>
      </div>

      <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">Present / Absent</p>
            <h2 className="mt-2 text-2xl font-black text-neutral-950">Employee Status Report</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">Active employees ke mutabiq selected date/range me Present, Absent, Open aur Complete status.</p>
          </div>
          <div className="text-sm font-bold text-neutral-500">Rows: {attendanceStatusRows.length}</div>
        </div>

        <div className="mt-5">
          {loadingLogs || loadingEmployees ? (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-10 text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#a30105]" />
              <p className="mt-3 text-sm font-bold text-neutral-600">Loading attendance status...</p>
            </div>
          ) : attendanceStatusRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
              <h3 className="text-xl font-black text-neutral-950">No Active Employees Found</h3>
              <p className="mt-2 text-sm text-neutral-500">Active employees list empty hai ya current filters se koi employee match nahi ho raha.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px] border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-black uppercase tracking-wider text-neutral-500">
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Home Branch</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Check In</th>
                    <th className="px-3 py-2">Check Out</th>
                    <th className="px-3 py-2">Detected Branch</th>
                    <th className="px-3 py-2">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceStatusRows.map((row) => (
                    <tr key={row.employee_id}>
                      <td className="rounded-l-2xl border-y border-l border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#a30105] shadow-sm">
                            <UserRound className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-black text-neutral-950">{row.employee_name}</div>
                            <div className="mt-1 text-xs font-bold text-neutral-500">{row.employee_phone || row.employee_email || "No contact"}</div>
                            <div className="mt-1 text-xs font-bold text-neutral-500">{row.designation || "No designation"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <div className="font-black text-neutral-950">{row.home_branch || "No branch"}</div>
                      </td>
                      <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${
                            row.status === "Absent"
                              ? "border-red-200 bg-red-50 text-red-700"
                              : row.status === "Open"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : row.status === "Complete"
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-blue-200 bg-blue-50 text-blue-700"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <div className="text-sm font-bold text-neutral-700">{formatDate(row.check_in_at)}</div>
                      </td>
                      <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <div className="text-sm font-bold text-neutral-700">{formatDate(row.check_out_at)}</div>
                      </td>
                      <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <div className="font-black text-neutral-950">{row.detected_branch || "No log"}</div>
                      </td>
                      <td className="rounded-r-2xl border-y border-r border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          {row.outside_radius ? <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[10px] font-black uppercase text-red-700">Outside</span> : null}
                          {row.shifted_branch ? <span className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-[10px] font-black uppercase text-purple-700">Shifted</span> : null}
                          {row.status !== "Absent" && !row.has_check_in_photo ? <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase text-amber-700">No In Photo</span> : null}
                          {row.status === "Complete" && !row.has_check_out_photo ? <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase text-amber-700">No Out Photo</span> : null}
                          {!row.outside_radius && !row.shifted_branch && (row.status === "Absent" || row.has_check_in_photo) ? <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-[10px] font-black uppercase text-neutral-600">Clear</span> : null}
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

      <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">Employee Wise</p>
            <h2 className="mt-2 text-2xl font-black text-neutral-950">Employee Attendance Summary</h2>
          </div>
          <div className="text-sm font-bold text-neutral-500">Rows: {employeeRows.length}</div>
        </div>

        <div className="mt-5">
          {loadingLogs ? (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-10 text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#a30105]" />
              <p className="mt-3 text-sm font-bold text-neutral-600">Loading employee report...</p>
            </div>
          ) : employeeRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
              <h3 className="text-xl font-black text-neutral-950">No Employee Report Found</h3>
              <p className="mt-2 text-sm text-neutral-500">Attendance data will appear here after check-in/check-out records.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px] border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-black uppercase tracking-wider text-neutral-500">
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Home Branch</th>
                    <th className="px-3 py-2">Present</th>
                    <th className="px-3 py-2">Completed</th>
                    <th className="px-3 py-2">Open</th>
                    <th className="px-3 py-2">Outside Radius</th>
                    <th className="px-3 py-2">Shifted Branch</th>
                    <th className="px-3 py-2">Photo Issues</th>
                    <th className="px-3 py-2">Last Date</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeRows.map((row) => (
                    <tr key={row.employee_id}>
                      <td className="rounded-l-2xl border-y border-l border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#a30105] shadow-sm">
                            <UserRound className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-black text-neutral-950">{row.employee_name}</div>
                            <div className="mt-1 text-xs font-bold text-neutral-500">{row.employee_phone || row.employee_email || "No contact"}</div>
                            <div className="mt-1 text-xs font-bold text-neutral-500">{row.designation || "No designation"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <div className="font-black text-neutral-950">{row.home_branch || "No branch"}</div>
                      </td>
                      <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{row.present_days}</span>
                      </td>
                      <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-black text-green-700">{row.completed_days}</span>
                      </td>
                      <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">{row.open_days}</span>
                      </td>
                      <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${row.outside_radius ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>{row.outside_radius}</span>
                      </td>
                      <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${row.shifted_branch_days ? "border-purple-200 bg-purple-50 text-purple-700" : "border-neutral-200 bg-white text-neutral-600"}`}>{row.shifted_branch_days}</span>
                      </td>
                      <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <div className="text-xs font-bold text-neutral-600">In: {row.missing_check_in_photo}</div>
                        <div className="mt-1 text-xs font-bold text-neutral-600">Out: {row.missing_check_out_photo}</div>
                      </td>
                      <td className="rounded-r-2xl border-y border-r border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <div className="text-sm font-bold text-neutral-700">{formatOnlyDate(row.last_attendance_date)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">Branch Wise</p>
            <h2 className="mt-2 text-2xl font-black text-neutral-950">Branch Attendance Summary</h2>
          </div>
          <div className="text-sm font-bold text-neutral-500">Rows: {branchRows.length}</div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {branchRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center md:col-span-2 xl:col-span-3">
              <h3 className="text-xl font-black text-neutral-950">No Branch Report Found</h3>
              <p className="mt-2 text-sm text-neutral-500">Branch summaries will appear after attendance records.</p>
            </div>
          ) : (
            branchRows.map((row) => (
              <div key={row.branch_name} className="rounded-[26px] border border-neutral-200 bg-neutral-50 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-neutral-950">{row.branch_name}</h3>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wider text-neutral-500">{row.employees} employees</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#a30105] shadow-sm">
                    <Building2 className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-neutral-200 bg-white p-3">
                    <div className="text-[11px] font-black uppercase text-neutral-500">Logs</div>
                    <div className="mt-1 text-2xl font-black text-neutral-950">{row.logs}</div>
                  </div>
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-3">
                    <div className="text-[11px] font-black uppercase text-green-700">Completed</div>
                    <div className="mt-1 text-2xl font-black text-green-700">{row.completed}</div>
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                    <div className="text-[11px] font-black uppercase text-amber-700">Open</div>
                    <div className="mt-1 text-2xl font-black text-amber-700">{row.open}</div>
                  </div>
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-3">
                    <div className="text-[11px] font-black uppercase text-red-700">Outside</div>
                    <div className="mt-1 text-2xl font-black text-red-700">{row.outside_radius}</div>
                  </div>
                </div>

                {row.shifted_branch ? (
                  <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50 p-3 text-xs font-black uppercase text-purple-700">
                    Shifted Branch Logs: {row.shifted_branch}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">Latest Logs</p>
            <h2 className="mt-2 text-2xl font-black text-neutral-950">Recent Attendance Records</h2>
          </div>
          <div className="text-sm font-bold text-neutral-500">Showing latest {Math.min(logs.length, 30)} of {logs.length}</div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1100px] border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-xs font-black uppercase tracking-wider text-neutral-500">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Branch</th>
                <th className="px-3 py-2">Check In</th>
                <th className="px-3 py-2">Check Out</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Photos</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 30).map((log) => {
                const employee = getEmployeeFromLog(log);
                return (
                  <tr key={log.id}>
                    <td className="rounded-l-2xl border-y border-l border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      <div className="text-sm font-black text-neutral-950">{formatOnlyDate(log.attendance_date)}</div>
                    </td>
                    <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      <div className="font-black text-neutral-950">{employee?.employee_name || "Employee"}</div>
                      <div className="mt-1 text-xs font-bold text-neutral-500">{employee?.employee_phone || employee?.employee_email || "No contact"}</div>
                    </td>
                    <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      <div className="font-black text-neutral-950">{getDetectedBranch(log)}</div>
                      {isShiftedBranch(log) ? <div className="mt-1 text-xs font-black uppercase text-purple-700">Shifted branch</div> : null}
                    </td>
                    <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      <div className="text-sm font-bold text-neutral-700">{formatDate(log.check_in_at)}</div>
                    </td>
                    <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      <div className="text-sm font-bold text-neutral-700">{formatDate(log.check_out_at)}</div>
                    </td>
                    <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      {isOutsideRadius(log) ? (
                        <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black uppercase text-red-700">Outside radius</span>
                      ) : log.check_in_at && !log.check_out_at ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black uppercase text-amber-700">Open</span>
                      ) : (
                        <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-black uppercase text-green-700">Complete</span>
                      )}
                    </td>
                    <td className="rounded-r-2xl border-y border-r border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      <div className="flex min-w-[150px] flex-col gap-2">
                        {log.check_in_photo_url ? (
                          <button
                            type="button"
                            onClick={() =>
                              openPhotoPreview({
                                url: String(log.check_in_photo_url || ""),
                                photoType: "Check-in",
                                employeeName: employee?.employee_name || "Employee",
                                branchName: getDetectedBranch(log),
                                attendanceDate: formatOnlyDate(log.attendance_date),
                                timeText: formatDate(log.check_in_at),
                              })
                            }
                            className="inline-flex items-center justify-center gap-1 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-black uppercase text-green-700 transition hover:bg-green-100"
                          >
                            In Photo <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-black uppercase text-neutral-500">
                            No in photo
                          </span>
                        )}

                        {log.check_out_photo_url ? (
                          <button
                            type="button"
                            onClick={() =>
                              openPhotoPreview({
                                url: String(log.check_out_photo_url || ""),
                                photoType: "Check-out",
                                employeeName: employee?.employee_name || "Employee",
                                branchName: getDetectedBranch(log),
                                attendanceDate: formatOnlyDate(log.attendance_date),
                                timeText: formatDate(log.check_out_at),
                              })
                            }
                            className="inline-flex items-center justify-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black uppercase text-blue-700 transition hover:bg-blue-100"
                          >
                            Out Photo <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-black uppercase text-neutral-500">
                            No out photo
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {photoPreview ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 px-4 py-6 backdrop-blur-sm">
          <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[30px] border border-neutral-200 bg-white shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
            <div className="flex flex-col gap-3 border-b border-neutral-200 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-[#a30105]">
                  Attendance Verification
                </p>
                <h3 className="mt-2 text-2xl font-black text-neutral-950">{photoPreview.title}</h3>
                <div className="mt-3 grid gap-2 text-sm font-bold text-neutral-600 sm:grid-cols-2">
                  <div>Employee: <span className="text-neutral-950">{photoPreview.employeeName}</span></div>
                  <div>Branch: <span className="text-neutral-950">{photoPreview.branchName}</span></div>
                  <div>Date: <span className="text-neutral-950">{photoPreview.attendanceDate}</span></div>
                  <div>Time: <span className="text-neutral-950">{photoPreview.timeText}</span></div>
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                <a
                  href={photoPreview.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-xs font-black uppercase text-neutral-800 transition hover:bg-neutral-50"
                >
                  Open Tab <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  onClick={closePhotoPreview}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 text-neutral-900 transition hover:bg-neutral-100"
                  aria-label="Close photo preview"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto bg-neutral-950 p-4">
              <div className="flex min-h-[55vh] items-center justify-center rounded-[24px] bg-black">
                <img
                  src={photoPreview.url}
                  alt={`${photoPreview.photoType} attendance photo for ${photoPreview.employeeName}`}
                  className="max-h-[72vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
                />
              </div>
            </div>

            <div className="border-t border-neutral-200 bg-neutral-50 px-5 py-4 text-xs font-bold text-neutral-500">
              Photo preview is shown inside the report page for quick verification. Open Tab is available for full browser view.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
