"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  Link2,
  MapPin,
  Navigation,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  ShieldCheck,
  UserRound,
  UsersRound,
  Unlink,
  X,
  XCircle,
} from "lucide-react";
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

type AttendanceUser = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  role: string;
  is_active: boolean;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
};

type BranchRow = {
  id: string;
  branch_name: string;
  branch_code: string | null;
  latitude: number | null;
  longitude: number | null;
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

type SummaryState = {
  total: number;
  active: number;
  inactive: number;
  branches: string[];
};

type BranchSummary = {
  total: number;
  active: number;
  inactive: number;
  with_location: number;
  missing_location: number;
};

type BranchReportRow = {
  branch_name: string;
  total: number;
  checked_in: number;
  checked_out: number;
  open: number;
  outside_radius: number;
  erp_pending: number;
  erp_synced: number;
  with_check_in_photo: number;
  with_check_out_photo: number;
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
  with_check_in_photo: number;
  with_check_out_photo: number;
  branch_reports: BranchReportRow[];
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

type EmployeeEditForm = EmployeeForm & {
  user_id: string | null;
  is_active: boolean;
};

type BranchForm = {
  branch_name: string;
  branch_code: string;
  latitude: string;
  longitude: string;
  allowed_radius_meters: string;
  is_active: boolean;
  notes: string;
};

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

const DEFAULT_SUMMARY: SummaryState = {
  total: 0,
  active: 0,
  inactive: 0,
  branches: [],
};

const DEFAULT_BRANCH_SUMMARY: BranchSummary = {
  total: 0,
  active: 0,
  inactive: 0,
  with_location: 0,
  missing_location: 0,
};

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
  branch_reports: [],
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

const DEFAULT_EDIT_FORM: EmployeeEditForm = {
  ...DEFAULT_FORM,
  user_id: null,
  is_active: true,
};

const DEFAULT_BRANCH_FORM: BranchForm = {
  branch_name: "",
  branch_code: "",
  latitude: "",
  longitude: "",
  allowed_radius_meters: "150",
  is_active: true,
  notes: "",
};

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last_7_days", label: "Last 7 Days" },
  { key: "last_30_days", label: "Last 30 Days" },
  { key: "all_time", label: "All Time" },
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

function formatDistance(value: number | null | undefined) {
  if (value === null || value === undefined) return "Not available";
  return `${value}m`;
}

function locationText(employee: EmployeeRow) {
  if (employee.allowed_latitude === null || employee.allowed_longitude === null) {
    return "Location not set";
  }

  return `${employee.allowed_latitude}, ${employee.allowed_longitude}`;
}

function branchLocationText(branch: BranchRow) {
  if (branch.latitude === null || branch.longitude === null) {
    return "Location not set";
  }

  return `${branch.latitude}, ${branch.longitude}`;
}

function mapsUrl(latitude: number | null, longitude: number | null) {
  if (latitude === null || longitude === null) return "";
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function getEmployeeFromLog(log: AttendanceLog) {
  if (Array.isArray(log.admin_employees)) {
    return log.admin_employees[0] || null;
  }

  return log.admin_employees || null;
}

function getRadiusText(value: boolean | null | undefined) {
  if (value === true) return "Inside radius";
  if (value === false) return "Outside radius";
  return "Radius not checked";
}

function getRadiusClasses(value: boolean | null | undefined) {
  if (value === true) return "border-green-200 bg-green-50 text-green-700";
  if (value === false) return "border-red-200 bg-red-50 text-red-700";
  return "border-neutral-200 bg-neutral-50 text-neutral-600";
}

function getErpClasses(value: string | null | undefined) {
  const normalized = String(value || "pending").toLowerCase();

  if (normalized === "synced") return "border-green-200 bg-green-50 text-green-700";
  if (normalized === "failed" || normalized === "error") return "border-red-200 bg-red-50 text-red-700";

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function statCardClass(className: string) {
  return `rounded-[26px] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.05)] ${className}`;
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

  const [attendanceUsers, setAttendanceUsers] = useState<AttendanceUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [linkingUser, setLinkingUser] = useState<string | null>(null);
  const [selectedUserByEmployee, setSelectedUserByEmployee] = useState<Record<string, string>>({});

  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [branchSummary, setBranchSummary] = useState<BranchSummary>(DEFAULT_BRANCH_SUMMARY);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);
  const [deletingBranch, setDeletingBranch] = useState<string | null>(null);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [branchForm, setBranchForm] = useState<BranchForm>(DEFAULT_BRANCH_FORM);
  const [branchErrorText, setBranchErrorText] = useState("");
  const [branchSuccessText, setBranchSuccessText] = useState("");

  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [logsSummary, setLogsSummary] = useState<LogsSummaryState>(DEFAULT_LOGS_SUMMARY);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logDateFilter, setLogDateFilter] = useState<DateFilter>("today");
  const [logSearch, setLogSearch] = useState("");
  const [logBranchFilter, setLogBranchFilter] = useState("");

  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EmployeeForm>(DEFAULT_FORM);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EmployeeEditForm>(DEFAULT_EDIT_FORM);
  const [savingEmployeeUpdate, setSavingEmployeeUpdate] = useState(false);

  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [logsErrorText, setLogsErrorText] = useState("");
  const [clearingLogs, setClearingLogs] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<PhotoPreview | null>(null);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  function getUserLabel(user: AttendanceUser) {
    const name = String(user.full_name || "").trim();
    const email = String(user.email || "").trim();

    if (name && email) return `${name} — ${email}`;
    if (email) return email;
    if (name) return name;

    return user.id;
  }

  function getLinkedUser(employee: EmployeeRow) {
    if (!employee.user_id) return null;

    return attendanceUsers.find((user) => user.id === employee.user_id) || null;
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

  async function loadAttendanceUsers(options?: { tokenFromCheck?: string }) {
    setLoadingUsers(true);

    try {
      const token = options?.tokenFromCheck || (await getAccessToken());

      if (!token) {
        router.replace("/account/login?next=/admin/attendance");
        return;
      }

      const res = await fetch("/api/admin/attendance/users", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load user accounts.");
      }

      setAttendanceUsers(Array.isArray(json?.users) ? json.users : []);

      if (json?.admin) {
        setAdminUser(json.admin);
        setAdminEmail(json.admin.email || "");
      }
    } catch (error: any) {
      setErrorText(error?.message || "Failed to load user accounts.");
      setAttendanceUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function linkEmployeeUser(employeeId: string, userId: string | null) {
    const actionKey = userId ? `link:${employeeId}` : `unlink:${employeeId}`;
    setLinkingUser(actionKey);
    setErrorText("");
    setSuccessText("");

    try {
      const token = await getAccessToken();

      if (!token) {
        router.replace("/account/login?next=/admin/attendance");
        return;
      }

      const res = await fetch(`/api/admin/attendance/employees/${employeeId}/user`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userId,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to update employee user link.");
      }

      setSuccessText(json?.message || "Employee user link updated successfully.");

      if (!userId) {
        setSelectedUserByEmployee((current) => ({
          ...current,
          [employeeId]: "",
        }));
      }

      await Promise.all([
        loadEmployees({ tokenFromCheck: token }),
        loadLogs({ tokenFromCheck: token }),
      ]);
    } catch (error: any) {
      setErrorText(error?.message || "Failed to update employee user link.");
    } finally {
      setLinkingUser(null);
    }
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

      if (nextSearch.trim()) params.set("search", nextSearch.trim());
      if (nextBranch.trim()) params.set("branch", nextBranch.trim());
      if (nextActive !== "all") params.set("active", nextActive);

      const res = await fetch(`/api/admin/attendance/employees?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
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

  async function loadBranches(options?: { tokenFromCheck?: string }) {
    setLoadingBranches(true);
    setBranchErrorText("");

    try {
      const token = options?.tokenFromCheck || (await getAccessToken());

      if (!token) {
        router.replace("/account/login?next=/admin/attendance");
        return;
      }

      const res = await fetch("/api/admin/attendance/branches", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load branch locations.");
      }

      setBranches(Array.isArray(json?.branches) ? json.branches : []);
      setBranchSummary(json?.summary || DEFAULT_BRANCH_SUMMARY);

      if (json?.admin) {
        setAdminUser(json.admin);
        setAdminEmail(json.admin.email || "");
      }
    } catch (error: any) {
      setBranchErrorText(error?.message || "Failed to load branch locations.");
      setBranches([]);
      setBranchSummary(DEFAULT_BRANCH_SUMMARY);
    } finally {
      setLoadingBranches(false);
    }
  }

  async function loadLogs(options?: {
    searchValue?: string;
    branchValue?: string;
    dateValue?: DateFilter;
    tokenFromCheck?: string;
  }) {
    setLoadingLogs(true);
    setLogsErrorText("");

    const nextSearch = options?.searchValue ?? logSearch;
    const nextBranch = options?.branchValue ?? logBranchFilter;
    const nextDate = options?.dateValue ?? logDateFilter;

    try {
      const token = options?.tokenFromCheck || (await getAccessToken());

      if (!token) {
        router.replace("/account/login?next=/admin/attendance");
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
        throw new Error(json?.error || "Failed to load attendance logs.");
      }

      setLogs(Array.isArray(json?.logs) ? json.logs : []);
      setLogsSummary(json?.summary || DEFAULT_LOGS_SUMMARY);

      if (json?.admin) {
        setAdminUser(json.admin);
        setAdminEmail(json.admin.email || "");
      }
    } catch (error: any) {
      setLogsErrorText(error?.message || "Failed to load attendance logs.");
      setLogs([]);
      setLogsSummary(DEFAULT_LOGS_SUMMARY);
    } finally {
      setLoadingLogs(false);
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
      if (!res.ok) throw new Error(json?.error || "Failed to create employee.");

      setForm(DEFAULT_FORM);
      setShowForm(false);
      setSuccessText("Employee created successfully.");
      await Promise.all([loadEmployees({ tokenFromCheck: token }), loadLogs({ tokenFromCheck: token })]);
    } catch (error: any) {
      setErrorText(error?.message || "Failed to create employee.");
    } finally {
      setSavingEmployee(false);
    }
  }

  async function saveBranchLocation() {
    setSavingBranch(true);
    setBranchErrorText("");
    setBranchSuccessText("");

    try {
      const token = await getAccessToken();
      if (!token) {
        router.replace("/account/login?next=/admin/attendance");
        return;
      }

      const res = await fetch("/api/admin/attendance/branches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(branchForm),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to save branch location.");

      setBranchSuccessText(json?.message || "Branch location saved successfully.");
      setBranchForm(DEFAULT_BRANCH_FORM);
      setEditingBranchId(null);
      setShowBranchForm(false);
      await loadBranches({ tokenFromCheck: token });
    } catch (error: any) {
      setBranchErrorText(error?.message || "Failed to save branch location.");
    } finally {
      setSavingBranch(false);
    }
  }

  async function deleteBranchLocation(branch: BranchRow) {
    const branchName = branch.branch_name || "this branch";

    if (
      !window.confirm(
        `Are you sure you want to delete branch location "${branchName}"? Attendance logs will stay safe.`
      )
    ) {
      return;
    }

    setDeletingBranch(branch.id);
    setBranchErrorText("");
    setBranchSuccessText("");

    try {
      const token = await getAccessToken();

      if (!token) {
        router.replace("/account/login?next=/admin/attendance");
        return;
      }

      const res = await fetch(`/api/admin/attendance/branches/${branch.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to delete branch location.");
      }

      setBranchSuccessText(json?.message || "Branch location deleted successfully.");

      if (editingBranchId === branch.id) {
        setEditingBranchId(null);
        setBranchForm(DEFAULT_BRANCH_FORM);
        setShowBranchForm(false);
      }

      await loadBranches({ tokenFromCheck: token });
    } catch (error: any) {
      setBranchErrorText(error?.message || "Failed to delete branch location.");
    } finally {
      setDeletingBranch(null);
    }
  }

  function getBrowserLocation(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geo location is not supported on this device."));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      });
    });
  }

  async function fillBranchCurrentLocation() {
    setBranchErrorText("");
    setBranchSuccessText("");

    try {
      const position = await getBrowserLocation();

      setBranchForm((current) => ({
        ...current,
        latitude: String(position.coords.latitude),
        longitude: String(position.coords.longitude),
      }));

      setBranchSuccessText("Current location filled. Review and save branch location.");
    } catch (error: any) {
      setBranchErrorText(error?.message || "Location permission denied.");
    }
  }

  function editBranch(branch: BranchRow) {
    setEditingBranchId(branch.id);
    setShowBranchForm(true);
    setBranchErrorText("");
    setBranchSuccessText("");
    setBranchForm({
      branch_name: branch.branch_name || "",
      branch_code: branch.branch_code || "",
      latitude: branch.latitude === null || branch.latitude === undefined ? "" : String(branch.latitude),
      longitude: branch.longitude === null || branch.longitude === undefined ? "" : String(branch.longitude),
      allowed_radius_meters: String(branch.allowed_radius_meters || 150),
      is_active: branch.is_active !== false,
      notes: branch.notes || "",
    });
  }

  function startNewBranch() {
    setEditingBranchId(null);
    setBranchForm(DEFAULT_BRANCH_FORM);
    setBranchErrorText("");
    setBranchSuccessText("");
    setShowBranchForm((current) => !current);
  }

  function updateForm(key: keyof EmployeeForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrorText("");
    setSuccessText("");
  }

  function updateEditForm(key: keyof EmployeeEditForm, value: string | boolean | null) {
    setEditForm((current) => ({ ...current, [key]: value }));
    setErrorText("");
    setSuccessText("");
  }

  function startEditEmployee(employee: EmployeeRow) {
    setEditingEmployeeId(employee.id);
    setEditForm({
      user_id: employee.user_id || null,
      employee_name: employee.employee_name || "",
      employee_email: employee.employee_email || "",
      employee_phone: employee.employee_phone || "",
      erp_employee_id: employee.erp_employee_id || "",
      branch_name: employee.branch_name || "",
      designation: employee.designation || "",
      allowed_latitude:
        employee.allowed_latitude === null || employee.allowed_latitude === undefined
          ? ""
          : String(employee.allowed_latitude),
      allowed_longitude:
        employee.allowed_longitude === null || employee.allowed_longitude === undefined
          ? ""
          : String(employee.allowed_longitude),
      allowed_radius_meters: String(employee.allowed_radius_meters || 150),
      notes: employee.notes || "",
      is_active: employee.is_active !== false,
    });
    setShowForm(false);
    setErrorText("");
    setSuccessText("");

    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        document.getElementById("employee-edit-panel")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 50);
    }
  }

  function cancelEditEmployee() {
    setEditingEmployeeId(null);
    setEditForm(DEFAULT_EDIT_FORM);
    setSavingEmployeeUpdate(false);
  }

  async function updateEmployee() {
    if (!editingEmployeeId) return;

    setSavingEmployeeUpdate(true);
    setErrorText("");
    setSuccessText("");

    try {
      const token = await getAccessToken();

      if (!token) {
        router.replace("/account/login?next=/admin/attendance");
        return;
      }

      const res = await fetch(`/api/admin/attendance/employees/${editingEmployeeId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employee_name: editForm.employee_name,
          employee_email: editForm.employee_email,
          employee_phone: editForm.employee_phone,
          erp_employee_id: editForm.erp_employee_id,
          branch_name: editForm.branch_name,
          designation: editForm.designation,
          allowed_latitude: editForm.allowed_latitude,
          allowed_longitude: editForm.allowed_longitude,
          allowed_radius_meters: editForm.allowed_radius_meters,
          notes: editForm.notes,
          is_active: editForm.is_active,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to update employee.");
      }

      setSuccessText(json?.message || "Employee updated successfully.");
      cancelEditEmployee();
      await Promise.all([
        loadEmployees({ tokenFromCheck: token }),
        loadLogs({ tokenFromCheck: token }),
      ]);
    } catch (error: any) {
      setErrorText(error?.message || "Failed to update employee.");
    } finally {
      setSavingEmployeeUpdate(false);
    }
  }

  function updateBranchForm(key: keyof BranchForm, value: string | boolean) {
    setBranchForm((current) => ({ ...current, [key]: value }));
    setBranchErrorText("");
    setBranchSuccessText("");
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
    loadEmployees({ searchValue: "", branchValue: "", activeValue: "all" });
  }

  function submitLogSearch(nextSearch: string) {
    const cleanSearch = nextSearch.trim();
    setLogSearch(cleanSearch);
    loadLogs({ searchValue: cleanSearch });
  }

  function changeLogBranch(nextBranch: string) {
    setLogBranchFilter(nextBranch);
    loadLogs({ branchValue: nextBranch });
  }

  function changeLogDate(nextDate: DateFilter) {
    setLogDateFilter(nextDate);
    loadLogs({ dateValue: nextDate });
  }

  function resetLogFilters() {
    setLogSearch("");
    setLogBranchFilter("");
    setLogDateFilter("today");
    loadLogs({ searchValue: "", branchValue: "", dateValue: "today" });
  }

  async function clearAttendanceLogs(
    mode: "today" | "single" | "employee" | "all",
    options?: { logId?: string; employeeId?: string; employeeName?: string }
  ) {
    const confirmMessage =
      mode === "today"
        ? "Are you sure you want to clear today's attendance logs?"
        : mode === "single"
        ? "Are you sure you want to delete this attendance log?"
        : mode === "employee"
        ? `Are you sure you want to clear all attendance logs for ${
            options?.employeeName || "this employee"
          }?`
        : "Are you sure you want to clear all attendance logs?";

    if (!window.confirm(confirmMessage)) return;

    const clearingKey =
      mode === "single"
        ? `single:${options?.logId || ""}`
        : mode === "employee"
        ? `employee:${options?.employeeId || ""}`
        : mode;

    setClearingLogs(clearingKey);
    setLogsErrorText("");
    setSuccessText("");

    try {
      const token = await getAccessToken();

      if (!token) {
        router.replace("/account/login?next=/admin/attendance");
        return;
      }

      const url =
        mode === "all"
          ? "/api/admin/attendance/logs/clear?confirm=CLEAR_ALL_ATTENDANCE_LOGS"
          : "/api/admin/attendance/logs/clear";

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mode,
          log_id: options?.logId,
          employee_id: options?.employeeId,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to clear attendance logs.");
      }

      setSuccessText(json?.message || "Attendance logs cleared successfully.");
      await loadLogs({ tokenFromCheck: token });
    } catch (error: any) {
      setLogsErrorText(error?.message || "Failed to clear attendance logs.");
    } finally {
      setClearingLogs(null);
    }
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

      await Promise.all([
        loadEmployees({ tokenFromCheck: session.access_token }),
        loadAttendanceUsers({ tokenFromCheck: session.access_token }),
        loadBranches({ tokenFromCheck: session.access_token }),
        loadLogs({ tokenFromCheck: session.access_token }),
      ]);
    }

    initAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const stats = useMemo(
    () => [
      { label: "Total Employees", value: summary.total, icon: UsersRound, className: "border-neutral-200 bg-white text-neutral-950" },
      { label: "Active Employees", value: summary.active, icon: CheckCircle2, className: "border-green-200 bg-green-50 text-green-700" },
      { label: "Inactive Employees", value: summary.inactive, icon: XCircle, className: "border-red-200 bg-red-50 text-red-700" },
      { label: "Branches", value: branchSummary.total || summary.branches.length, icon: Building2, className: "border-[#a30105]/20 bg-[#fff7f7] text-[#a30105]" },
    ],
    [summary, branchSummary]
  );

  const branchStats = useMemo(
    () => [
      { label: "Total Branches", value: branchSummary.total, icon: Building2, className: "border-neutral-200 bg-white text-neutral-950" },
      { label: "Active Branches", value: branchSummary.active, icon: CheckCircle2, className: "border-green-200 bg-green-50 text-green-700" },
      { label: "With Location", value: branchSummary.with_location, icon: MapPin, className: "border-blue-200 bg-blue-50 text-blue-700" },
      { label: "Missing Location", value: branchSummary.missing_location, icon: AlertTriangle, className: "border-red-200 bg-red-50 text-red-700" },
    ],
    [branchSummary]
  );

  const logStats = useMemo(
    () => [
      { label: "Total Logs", value: logsSummary.total, icon: CalendarDays, className: "border-neutral-200 bg-white text-neutral-950" },
      { label: "Open Check-ins", value: logsSummary.open, icon: Clock3, className: "border-amber-200 bg-amber-50 text-amber-700" },
      { label: "Checked Out", value: logsSummary.checked_out, icon: CheckCircle2, className: "border-green-200 bg-green-50 text-green-700" },
      { label: "Outside Radius", value: logsSummary.outside_radius, icon: AlertTriangle, className: "border-red-200 bg-red-50 text-red-700" },
    ],
    [logsSummary]
  );

  const branchReportRows = useMemo(
    () => logsSummary.branch_reports || [],
    [logsSummary.branch_reports]
  );

  const allBranches = Array.from(
    new Set([
      ...summary.branches,
      ...logsSummary.branches,
      ...branches.map((branch) => branch.branch_name),
    ].filter(Boolean))
  );

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
        <h1 className="mt-4 text-2xl font-black text-neutral-950">Attendance Access Required</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-500">{accessError}</p>
        <Link href="/admin" className="mt-6 inline-flex rounded-2xl bg-[#a30105] px-5 py-3 text-sm font-bold text-white">
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
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">HR Attendance</p>
            <h1 className="mt-3 text-3xl font-black text-neutral-950">Employee Attendance</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              Employee master list, branch geo locations, attendance logs and nearest-branch detection foundation.
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

            <button
              type="button"
              onClick={startNewBranch}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#a30105]/20 bg-[#fff7f7] px-5 py-3 text-sm font-black text-[#a30105] transition hover:bg-[#fff1f1]"
            >
              <MapPin className="h-4 w-4" />
              {showBranchForm ? "Close Branch" : "Add Branch Location"}
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
            <div key={stat.label} className={statCardClass(stat.className)}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/75">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-5 text-sm font-bold uppercase tracking-wider opacity-80">{stat.label}</div>
              <div className="mt-2 text-3xl font-black">{stat.value}</div>
            </div>
          );
        })}
      </div>

      {showBranchForm ? (
        <div className="rounded-[30px] border border-blue-200 bg-blue-50 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-black text-neutral-950">
                {editingBranchId ? "Update Branch Location" : "Add Branch Location"}
              </h2>
              <p className="mt-2 text-sm font-bold leading-6 text-blue-700">
                Branch ke andar kharay ho kar “Use Current Location” click karein. Ye branch master location employee shuffle handling ke liay use hogi.
              </p>
            </div>

            <button
              type="button"
              onClick={fillBranchCurrentLocation}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-800"
            >
              <Navigation className="h-4 w-4" />
              Use Current Location
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <input
              value={branchForm.branch_name}
              onChange={(event) => updateBranchForm("branch_name", event.target.value)}
              placeholder="Branch Name *"
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-blue-700"
            />
            <input
              value={branchForm.branch_code}
              onChange={(event) => updateBranchForm("branch_code", event.target.value)}
              placeholder="Branch Code"
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-blue-700"
            />
            <input
              value={branchForm.latitude}
              onChange={(event) => updateBranchForm("latitude", event.target.value)}
              placeholder="Latitude"
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-blue-700"
            />
            <input
              value={branchForm.longitude}
              onChange={(event) => updateBranchForm("longitude", event.target.value)}
              placeholder="Longitude"
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-blue-700"
            />
            <input
              value={branchForm.allowed_radius_meters}
              onChange={(event) => updateBranchForm("allowed_radius_meters", event.target.value)}
              placeholder="Allowed Radius Meters"
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-blue-700"
            />
            <label className="flex h-12 items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-black text-neutral-800">
              <input
                type="checkbox"
                checked={branchForm.is_active}
                onChange={(event) => updateBranchForm("is_active", event.target.checked)}
              />
              Active Branch
            </label>
            <textarea
              value={branchForm.notes}
              onChange={(event) => updateBranchForm("notes", event.target.value)}
              placeholder="Notes"
              rows={3}
              className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-700 md:col-span-2"
            />
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs font-bold text-blue-700">
              {branchForm.latitude && branchForm.longitude ? `Selected: ${branchForm.latitude}, ${branchForm.longitude}` : "No location selected yet."}
            </div>

            <button
              type="button"
              onClick={saveBranchLocation}
              disabled={savingBranch}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#a30105] px-6 py-3 text-sm font-black text-white transition hover:bg-[#8f0104] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingBranch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingBranch ? "Saving..." : "Save Branch Location"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">Branch Locations</p>
            <h2 className="mt-2 text-2xl font-black text-neutral-950">Branch Geo Master</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Employee shuffle handling ke liay attendance GPS se nearest active branch auto-detect hogi.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadBranches()}
            disabled={loadingBranches}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-sm font-black text-neutral-900 transition hover:bg-neutral-50 disabled:opacity-60"
          >
            {loadingBranches ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh Branches
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {branchStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className={`rounded-[24px] border p-5 ${stat.className}`}>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/75">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-4 text-xs font-black uppercase tracking-wider opacity-80">{stat.label}</div>
                <div className="mt-2 text-2xl font-black">{stat.value}</div>
              </div>
            );
          })}
        </div>

        {branchSuccessText ? (
          <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700">{branchSuccessText}</div>
        ) : null}
        {branchErrorText ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{branchErrorText}</div>
        ) : null}

        <div className="mt-5">
          {loadingBranches ? (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-8 text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#a30105]" />
              <p className="mt-3 text-sm font-bold text-neutral-600">Loading branch locations...</p>
            </div>
          ) : branches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
              <h3 className="text-xl font-black text-neutral-950">No Branch Locations Found</h3>
              <p className="mt-2 text-sm text-neutral-500">Add branch locations to enable nearest-branch attendance detection.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-black uppercase tracking-wider text-neutral-500">
                    <th className="px-3 py-2">Branch</th>
                    <th className="px-3 py-2">Location</th>
                    <th className="px-3 py-2">Radius</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Updated</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((branch) => {
                    const url = mapsUrl(branch.latitude, branch.longitude);

                    return (
                      <tr key={branch.id}>
                        <td className="rounded-l-2xl border-y border-l border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                          <div className="font-black text-neutral-950">{branch.branch_name}</div>
                          <div className="mt-1 text-xs font-bold text-neutral-500">{branch.branch_code || "No code"}</div>
                        </td>
                        <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                          <div className="flex items-center gap-2 text-sm font-bold text-neutral-700">
                            <MapPin className="h-4 w-4 text-[#a30105]" />
                            {branchLocationText(branch)}
                          </div>
                        </td>
                        <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                          <div className="font-bold text-neutral-800">{branch.allowed_radius_meters || 150}m</div>
                        </td>
                        <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                          {branch.is_active ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-black uppercase text-green-700">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black uppercase text-red-700">
                              <XCircle className="h-3.5 w-3.5" /> Inactive
                            </span>
                          )}
                        </td>
                        <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                          <div className="text-sm font-bold text-neutral-700">{formatDate(branch.updated_at)}</div>
                        </td>
                        <td className="rounded-r-2xl border-y border-r border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => editBranch(branch)}
                              className="rounded-xl border border-[#a30105]/20 bg-white px-4 py-2 text-xs font-black uppercase text-[#a30105] hover:bg-[#fff7f7]"
                            >
                              Edit
                            </button>
                            {url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-black uppercase text-neutral-700 hover:bg-neutral-50"
                              >
                                Maps <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => deleteBranchLocation(branch)}
                              disabled={deletingBranch === branch.id}
                              className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-black uppercase text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {deletingBranch === branch.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
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

      {showForm ? (
        <div className="rounded-[30px] border border-[#a30105]/20 bg-[#fff7f7] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="mb-5">
            <h2 className="text-2xl font-black text-neutral-950">Add Employee</h2>
            <p className="mt-2 text-sm text-neutral-600">ERP Employee ID optional hai. Long term geo check branch master se hoga.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <input value={form.employee_name} onChange={(event) => updateForm("employee_name", event.target.value)} placeholder="Employee Name *" className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-[#a30105]" />
            <select
              value={form.branch_name}
              onChange={(event) => updateForm("branch_name", event.target.value)}
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-800 outline-none focus:border-[#a30105]"
            >
              <option value="">Select Home Branch *</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.branch_name}>
                  {branch.branch_name}
                  {branch.branch_code ? ` — ${branch.branch_code}` : ""}
                  {branch.is_active ? "" : " — Inactive"}
                </option>
              ))}
              {form.branch_name &&
              !branches.some((branch) => branch.branch_name === form.branch_name) ? (
                <option value={form.branch_name}>{form.branch_name}</option>
              ) : null}
            </select>
            <input value={form.employee_email} onChange={(event) => updateForm("employee_email", event.target.value)} placeholder="Employee Email" className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-[#a30105]" />
            <input value={form.employee_phone} onChange={(event) => updateForm("employee_phone", event.target.value)} placeholder="Employee Phone" className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-[#a30105]" />
            <input value={form.erp_employee_id} onChange={(event) => updateForm("erp_employee_id", event.target.value)} placeholder="ERPNext Employee ID" className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-[#a30105]" />
            <input value={form.designation} onChange={(event) => updateForm("designation", event.target.value)} placeholder="Designation" className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-[#a30105]" />
            <input value={form.allowed_radius_meters} onChange={(event) => updateForm("allowed_radius_meters", event.target.value)} placeholder="Fallback Radius Meters" className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-[#a30105]" />
            <textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="Notes" rows={3} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#a30105] md:col-span-2" />
          </div>

          <div className="mt-5 flex justify-end">
            <button type="button" onClick={createEmployee} disabled={savingEmployee} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#a30105] px-6 py-3 text-sm font-black text-white transition hover:bg-[#8f0104] disabled:cursor-not-allowed disabled:opacity-60">
              {savingEmployee ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {savingEmployee ? "Saving..." : "Save Employee"}
            </button>
          </div>
        </div>
      ) : null}

      {editingEmployeeId ? (
        <div
          id="employee-edit-panel"
          className="rounded-[30px] border border-amber-200 bg-amber-50 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.06)]"
        >
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-700">Employee Edit</p>
              <h2 className="mt-2 text-2xl font-black text-neutral-950">Update Employee Record</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-amber-700">
                Employee master data yahan se update hoga. User link/unlink neeche table se hi manage hoga.
              </p>
            </div>

            <button
              type="button"
              onClick={cancelEditEmployee}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-sm font-black text-neutral-900 transition hover:bg-neutral-50"
            >
              <XCircle className="h-4 w-4" />
              Cancel Edit
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <input
              value={editForm.employee_name}
              onChange={(event) => updateEditForm("employee_name", event.target.value)}
              placeholder="Employee Name *"
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-amber-700"
            />
            <select
              value={editForm.branch_name}
              onChange={(event) => updateEditForm("branch_name", event.target.value)}
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-800 outline-none focus:border-amber-700"
            >
              <option value="">Select Home Branch *</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.branch_name}>
                  {branch.branch_name}
                  {branch.branch_code ? ` — ${branch.branch_code}` : ""}
                  {branch.is_active ? "" : " — Inactive"}
                </option>
              ))}
              {editForm.branch_name &&
              !branches.some((branch) => branch.branch_name === editForm.branch_name) ? (
                <option value={editForm.branch_name}>{editForm.branch_name}</option>
              ) : null}
            </select>
            <input
              value={editForm.employee_email}
              onChange={(event) => updateEditForm("employee_email", event.target.value)}
              placeholder="Employee Email"
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-amber-700"
            />
            <input
              value={editForm.employee_phone}
              onChange={(event) => updateEditForm("employee_phone", event.target.value)}
              placeholder="Employee Phone"
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-amber-700"
            />
            <input
              value={editForm.erp_employee_id}
              onChange={(event) => updateEditForm("erp_employee_id", event.target.value)}
              placeholder="ERPNext Employee ID"
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-amber-700"
            />
            <input
              value={editForm.designation}
              onChange={(event) => updateEditForm("designation", event.target.value)}
              placeholder="Designation"
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-amber-700"
            />
            <input
              value={editForm.allowed_latitude}
              onChange={(event) => updateEditForm("allowed_latitude", event.target.value)}
              placeholder="Fallback Latitude (optional)"
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-amber-700"
            />
            <input
              value={editForm.allowed_longitude}
              onChange={(event) => updateEditForm("allowed_longitude", event.target.value)}
              placeholder="Fallback Longitude (optional)"
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-amber-700"
            />
            <input
              value={editForm.allowed_radius_meters}
              onChange={(event) => updateEditForm("allowed_radius_meters", event.target.value)}
              placeholder="Fallback Radius Meters"
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold outline-none focus:border-amber-700"
            />
            <label className="flex h-12 items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-black text-neutral-800">
              <input
                type="checkbox"
                checked={editForm.is_active}
                onChange={(event) => updateEditForm("is_active", event.target.checked)}
              />
              Active Employee
            </label>
            <textarea
              value={editForm.notes}
              onChange={(event) => updateEditForm("notes", event.target.value)}
              placeholder="Notes"
              rows={3}
              className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-amber-700 md:col-span-2"
            />
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs font-bold text-amber-700">
              Employee ID: {editingEmployeeId}
            </div>

            <button
              type="button"
              onClick={updateEmployee}
              disabled={savingEmployeeUpdate}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#a30105] px-6 py-3 text-sm font-black text-white transition hover:bg-[#8f0104] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingEmployeeUpdate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingEmployeeUpdate ? "Updating..." : "Update Employee"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-[30px] border border-neutral-200 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <form onSubmit={(event) => { event.preventDefault(); submitSearch(search); }} className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee, branch, phone, ERP ID..." className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 pl-11 pr-4 text-sm font-medium outline-none transition focus:border-[#a30105] focus:bg-white" />
          </div>
          <select value={branchFilter} onChange={(event) => changeBranch(event.target.value)} className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-black text-neutral-800 outline-none focus:border-[#a30105]">
            <option value="">All Branches</option>
            {allBranches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
          </select>
          <select value={activeFilter} onChange={(event) => changeActive(event.target.value)} className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-black text-neutral-800 outline-none focus:border-[#a30105]">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button type="submit" disabled={loadingEmployees} className="h-12 rounded-2xl bg-[#a30105] px-6 text-sm font-black text-white transition hover:bg-[#8f0104] disabled:opacity-60">{loadingEmployees ? "Loading..." : "Search"}</button>
          <button type="button" disabled={loadingEmployees} onClick={resetFilters} className="h-12 rounded-2xl border border-neutral-200 bg-white px-6 text-sm font-black text-neutral-900 transition hover:bg-neutral-50 disabled:opacity-60">Reset</button>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-sm font-bold text-blue-700">
            User accounts loaded for linking: {attendanceUsers.length}
          </div>
          <button
            type="button"
            onClick={() => loadAttendanceUsers()}
            disabled={loadingUsers}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-xs font-black uppercase text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingUsers ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh Users
          </button>
        </div>

        {successText ? <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700">{successText}</div> : null}
        {errorText ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{errorText}</div> : null}
      </div>

      <div className="rounded-[30px] border border-neutral-200 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        {loadingEmployees ? (
          <div className="p-10 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-[#a30105]" /><p className="mt-3 text-sm font-bold text-neutral-600">Loading employees...</p></div>
        ) : employees.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center"><h2 className="text-xl font-black text-neutral-950">No Employees Found</h2><p className="mt-2 text-sm text-neutral-500">Add employees to start attendance tracking.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1450px] border-separate border-spacing-y-3">
              <thead><tr className="text-left text-xs font-black uppercase tracking-wider text-neutral-500"><th className="px-3 py-2">Employee</th><th className="px-3 py-2">Home Branch</th><th className="px-3 py-2">ERP Link</th><th className="px-3 py-2">Fallback Geo</th><th className="px-3 py-2">Radius</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Linked User</th><th className="px-3 py-2">Updated</th><th className="px-3 py-2">Action</th></tr></thead>
              <tbody>
                {employees.map((employee) => {
                  const linkedUser = getLinkedUser(employee);
                  const selectedUserId =
                    selectedUserByEmployee[employee.id] ??
                    employee.user_id ??
                    "";

                  return (
                  <tr key={employee.id}>
                    <td className="rounded-l-2xl border-y border-l border-neutral-200 bg-neutral-50 px-3 py-4 align-top"><div className="flex items-start gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#a30105] shadow-sm"><UserRound className="h-5 w-5" /></div><div><div className="font-black text-neutral-950">{employee.employee_name}</div><div className="mt-1 text-xs font-bold text-neutral-500">{employee.employee_phone || employee.employee_email || "No contact"}</div><div className="mt-1 text-xs font-bold text-neutral-500">{employee.designation || "No designation"}</div></div></div></td>
                    <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top"><div className="font-black text-neutral-950">{employee.branch_name}</div></td>
                    <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top"><div className="text-sm font-bold text-neutral-700">{employee.erp_employee_id || "Not linked"}</div></td>
                    <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top"><div className="flex items-center gap-2 text-sm font-bold text-neutral-700"><MapPin className="h-4 w-4 text-[#a30105]" />{locationText(employee)}</div></td>
                    <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top"><div className="font-bold text-neutral-800">{employee.allowed_radius_meters || 150}m</div></td>
                    <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">{employee.is_active ? <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-black uppercase text-green-700"><CheckCircle2 className="h-3.5 w-3.5" />Active</span> : <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black uppercase text-red-700"><XCircle className="h-3.5 w-3.5" />Inactive</span>}</td>
                    <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      <div className="min-w-[280px] space-y-2">
                        {employee.user_id ? (
                          <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-black text-green-700">
                            Linked: {linkedUser ? getUserLabel(linkedUser) : employee.user_id}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">
                            Not linked with login account
                          </div>
                        )}

                        <select
                          value={selectedUserId}
                          onChange={(event) =>
                            setSelectedUserByEmployee((current) => ({
                              ...current,
                              [employee.id]: event.target.value,
                            }))
                          }
                          disabled={loadingUsers || linkingUser !== null}
                          className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-xs font-bold text-neutral-800 outline-none focus:border-[#a30105] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="">
                            {loadingUsers ? "Loading users..." : "Select user account"}
                          </option>
                          {attendanceUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {getUserLabel(user)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top"><div className="text-sm font-bold text-neutral-700">{formatDate(employee.updated_at)}</div></td>
                    <td className="rounded-r-2xl border-y border-r border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEditEmployee(employee)}
                          className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-black uppercase text-blue-700 transition hover:bg-blue-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => linkEmployeeUser(employee.id, selectedUserId || null)}
                          disabled={!selectedUserId || linkingUser !== null}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#a30105]/20 bg-white px-3 py-2 text-xs font-black uppercase text-[#a30105] transition hover:bg-[#fff7f7] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          {linkingUser === `link:${employee.id}` ? "Linking..." : "Link User"}
                        </button>

                        {employee.user_id ? (
                          <button
                            type="button"
                            onClick={() => linkEmployeeUser(employee.id, null)}
                            disabled={linkingUser !== null}
                            className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-black uppercase text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Unlink className="h-3.5 w-3.5" />
                            {linkingUser === `unlink:${employee.id}` ? "Unlinking..." : "Unlink"}
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() =>
                            clearAttendanceLogs("employee", {
                              employeeId: employee.id,
                              employeeName: employee.employee_name,
                            })
                          }
                          disabled={clearingLogs === `employee:${employee.id}`}
                          className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black uppercase text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {clearingLogs === `employee:${employee.id}` ? "Clearing..." : "Clear Logs"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">Attendance Logs</p><h2 className="mt-2 text-2xl font-black text-neutral-950">Check-in / Check-out History</h2><p className="mt-2 text-sm leading-6 text-neutral-500">Employee attendance logs with detected branch, distance, radius status and ERP sync status.</p></div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => clearAttendanceLogs("today")}
              disabled={Boolean(clearingLogs)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              {clearingLogs === "today" ? "Clearing..." : "Clear Today Logs"}
            </button>

            <button type="button" onClick={() => loadLogs()} disabled={loadingLogs} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-sm font-black text-neutral-900 transition hover:bg-neutral-50 disabled:opacity-60">{loadingLogs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}Refresh Logs</button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {logStats.map((stat) => { const Icon = stat.icon; return <div key={stat.label} className={`rounded-[24px] border p-5 ${stat.className}`}><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/75"><Icon className="h-5 w-5" /></div><div className="mt-4 text-xs font-black uppercase tracking-wider opacity-80">{stat.label}</div><div className="mt-2 text-2xl font-black">{stat.value}</div></div>; })}
        </div>

        <div className="mt-6 rounded-[28px] border border-neutral-200 bg-neutral-50 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#a30105]">
                Branch-wise Report
              </p>
              <h3 className="mt-2 text-2xl font-black text-neutral-950">
                Attendance Summary by Branch
              </h3>
              <p className="mt-2 text-sm font-bold leading-6 text-neutral-500">
                Current filter ke mutabiq branch-wise total, checked out, open check-ins, outside radius and ERP sync health.
              </p>
            </div>

            <div className="rounded-2xl border border-[#a30105]/20 bg-white px-4 py-3 text-xs font-black uppercase text-[#a30105]">
              {logDateFilter.replaceAll("_", " ")}
            </div>
          </div>

          {branchReportRows.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center">
              <h4 className="text-lg font-black text-neutral-950">No Branch Report Yet</h4>
              <p className="mt-2 text-sm font-bold text-neutral-500">
                Is filter me attendance logs milte hi branch report yahan show hogi.
              </p>
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[980px] border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-black uppercase tracking-wider text-neutral-500">
                    <th className="px-3 py-2">Branch</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Checked In</th>
                    <th className="px-3 py-2">Checked Out</th>
                    <th className="px-3 py-2">Open</th>
                    <th className="px-3 py-2">Outside Radius</th>
                    <th className="px-3 py-2">ERP</th>
                    <th className="px-3 py-2">Photos</th>
                  </tr>
                </thead>
                <tbody>
                  {branchReportRows.map((row) => {
                    const completionRate = row.total > 0 ? Math.round((row.checked_out / row.total) * 100) : 0;
                    const photoRate =
                      row.total > 0
                        ? Math.round(((row.with_check_in_photo + row.with_check_out_photo) / (row.total * 2)) * 100)
                        : 0;

                    return (
                      <tr key={row.branch_name}>
                        <td className="rounded-l-2xl border-y border-l border-neutral-200 bg-white px-3 py-4 align-top">
                          <div className="font-black text-neutral-950">{row.branch_name}</div>
                          <div className="mt-1 text-xs font-bold text-neutral-500">
                            Completion: {completionRate}%
                          </div>
                        </td>
                        <td className="border-y border-neutral-200 bg-white px-3 py-4 align-top">
                          <div className="text-2xl font-black text-neutral-950">{row.total}</div>
                        </td>
                        <td className="border-y border-neutral-200 bg-white px-3 py-4 align-top">
                          <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black uppercase text-blue-700">
                            {row.checked_in}
                          </span>
                        </td>
                        <td className="border-y border-neutral-200 bg-white px-3 py-4 align-top">
                          <span className="inline-flex rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-black uppercase text-green-700">
                            {row.checked_out}
                          </span>
                        </td>
                        <td className="border-y border-neutral-200 bg-white px-3 py-4 align-top">
                          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black uppercase text-amber-700">
                            {row.open}
                          </span>
                        </td>
                        <td className="border-y border-neutral-200 bg-white px-3 py-4 align-top">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${
                            row.outside_radius > 0
                              ? "border-red-200 bg-red-50 text-red-700"
                              : "border-green-200 bg-green-50 text-green-700"
                          }`}>
                            {row.outside_radius}
                          </span>
                        </td>
                        <td className="border-y border-neutral-200 bg-white px-3 py-4 align-top">
                          <div className="text-xs font-black uppercase text-amber-700">Pending: {row.erp_pending}</div>
                          <div className="mt-1 text-xs font-black uppercase text-green-700">Synced: {row.erp_synced}</div>
                        </td>
                        <td className="rounded-r-2xl border-y border-r border-neutral-200 bg-white px-3 py-4 align-top">
                          <div className="text-xs font-black uppercase text-neutral-700">
                            In: {row.with_check_in_photo} / Out: {row.with_check_out_photo}
                          </div>
                          <div className="mt-1 text-xs font-bold text-neutral-500">Photo coverage: {photoRate}%</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-3"><div className="flex flex-wrap gap-2">{DATE_FILTERS.map((filter) => { const active = logDateFilter === filter.key; return <button key={filter.key} type="button" onClick={() => changeLogDate(filter.key)} className={`rounded-full border px-4 py-2 text-xs font-black uppercase transition ${active ? "border-[#a30105]/25 bg-[#fff7f7] text-[#a30105]" : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"}`}>{filter.label}</button>; })}</div></div>

        <form onSubmit={(event) => { event.preventDefault(); submitLogSearch(logSearch); }} className="mt-4 flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" /><input value={logSearch} onChange={(event) => setLogSearch(event.target.value)} placeholder="Search logs by employee, branch, ERP, status..." className="h-12 w-full rounded-2xl border border-neutral-200 bg-white pl-11 pr-4 text-sm font-medium outline-none transition focus:border-[#a30105]" /></div>
          <select value={logBranchFilter} onChange={(event) => changeLogBranch(event.target.value)} className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-black text-neutral-800 outline-none focus:border-[#a30105]"><option value="">All Branches</option>{allBranches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select>
          <button type="submit" disabled={loadingLogs} className="h-12 rounded-2xl bg-[#a30105] px-6 text-sm font-black text-white transition hover:bg-[#8f0104] disabled:opacity-60">{loadingLogs ? "Loading..." : "Search"}</button>
          <button type="button" disabled={loadingLogs} onClick={resetLogFilters} className="h-12 rounded-2xl border border-neutral-200 bg-white px-6 text-sm font-black text-neutral-900 transition hover:bg-neutral-50 disabled:opacity-60">Reset</button>
        </form>

        {logsErrorText ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{logsErrorText}</div> : null}

        <div className="mt-5">
          {loadingLogs ? (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-10 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-[#a30105]" /><p className="mt-3 text-sm font-bold text-neutral-600">Loading attendance logs...</p></div>
          ) : logs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center"><h3 className="text-xl font-black text-neutral-950">No Attendance Logs Found</h3><p className="mt-2 text-sm text-neutral-500">Logs will appear here after employees check in or check out.</p></div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[1600px] border-separate border-spacing-y-3"><thead><tr className="text-left text-xs font-black uppercase tracking-wider text-neutral-500"><th className="px-3 py-2">Employee</th><th className="px-3 py-2">Branch / Date</th><th className="px-3 py-2">Detected Branch</th><th className="px-3 py-2">Check In</th><th className="px-3 py-2">Check Out</th><th className="px-3 py-2">Distance</th><th className="px-3 py-2">Radius</th><th className="px-3 py-2">ERP Sync</th><th className="px-3 py-2">Photos</th><th className="px-3 py-2">Device / IP</th><th className="px-3 py-2">Action</th></tr></thead><tbody>
              {logs.map((log) => {
                const employee = getEmployeeFromLog(log);
                const homeBranch = employee?.branch_name || "No home branch";
                const detectedBranch =
                  log.detected_branch_name || log.branch_name || homeBranch || "No branch";
                const finalRadius =
                  log.branch_within_radius ??
                  log.check_out_within_radius ??
                  log.check_in_within_radius;
                const cleanHomeBranch = String(homeBranch || "").trim().toLowerCase();
                const cleanDetectedBranch = String(detectedBranch || "").trim().toLowerCase();
                const isShiftedBranch =
                  Boolean(cleanHomeBranch) &&
                  Boolean(cleanDetectedBranch) &&
                  cleanHomeBranch !== "no home branch" &&
                  cleanDetectedBranch !== cleanHomeBranch;

                return <tr key={log.id}>
                  <td className="rounded-l-2xl border-y border-l border-neutral-200 bg-neutral-50 px-3 py-4 align-top"><div className="flex items-start gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#a30105] shadow-sm"><UserRound className="h-5 w-5" /></div><div><div className="font-black text-neutral-950">{employee?.employee_name || "Employee"}</div><div className="mt-1 text-xs font-bold text-neutral-500">{employee?.employee_phone || employee?.employee_email || "No contact"}</div><div className="mt-1 text-xs font-bold text-neutral-500">{employee?.designation || "No designation"}</div></div></div></td>
                  <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top"><div className="font-black text-neutral-950">{homeBranch}</div><div className="mt-1 text-xs font-bold text-neutral-500">Date: {formatOnlyDate(log.attendance_date)}</div><div className="mt-2 inline-flex rounded-full border border-neutral-200 bg-white px-3 py-1 text-[10px] font-black uppercase text-neutral-600">Home Branch</div></td>
                  <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top"><div className="font-black text-neutral-950">{detectedBranch}</div><div className="mt-1 text-xs font-bold text-neutral-500">Branch distance: {formatDistance(log.branch_distance_meters)}</div>{isShiftedBranch ? <div className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase text-amber-700">Shifted Branch</div> : <div className="mt-2 inline-flex rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[10px] font-black uppercase text-green-700">Home Branch</div>}</td>
                  <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top"><div className="text-sm font-black text-neutral-950">{formatDate(log.check_in_at)}</div></td>
                  <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top"><div className="text-sm font-black text-neutral-950">{formatDate(log.check_out_at)}</div></td>
                  <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top"><div className="text-xs font-bold text-neutral-500">Branch distance: {formatDistance(log.branch_distance_meters)}</div><div className="mt-1 text-xs font-bold text-neutral-500">Check-in: {formatDistance(log.check_in_distance_meters)}</div><div className="mt-1 text-xs font-bold text-neutral-500">Check-out: {formatDistance(log.check_out_distance_meters)}</div></td>
                  <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top"><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${getRadiusClasses(finalRadius)}`}>{getRadiusText(finalRadius)}</span></td>
                  <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top"><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${getErpClasses(log.erp_sync_status)}`}>{log.erp_sync_status || "pending"}</span>{log.erp_error ? <div className="mt-2 max-w-[260px] text-xs font-bold text-red-600">{log.erp_error}</div> : null}</td>
                  <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                    <div className="flex min-w-[150px] flex-col gap-2">
                      {log.check_in_photo_url ? (
                        <button
                          type="button"
                          onClick={() =>
                            openPhotoPreview({
                              url: String(log.check_in_photo_url || ""),
                              photoType: "Check-in",
                              employeeName: employee?.employee_name || "Employee",
                              branchName: detectedBranch,
                              attendanceDate: formatOnlyDate(log.attendance_date),
                              timeText: formatDate(log.check_in_at),
                            })
                          }
                          className="inline-flex items-center justify-center gap-1 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-black uppercase text-green-700 transition hover:bg-green-100"
                        >
                          Check-in Photo <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <span className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-black uppercase text-neutral-500">
                          No check-in photo
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
                              branchName: detectedBranch,
                              attendanceDate: formatOnlyDate(log.attendance_date),
                              timeText: formatDate(log.check_out_at),
                            })
                          }
                          className="inline-flex items-center justify-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black uppercase text-blue-700 transition hover:bg-blue-100"
                        >
                          Check-out Photo <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <span className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-black uppercase text-neutral-500">
                          No check-out photo
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top"><div className="max-w-[280px] truncate text-xs font-bold text-neutral-600">{log.device_info || "No device info"}</div><div className="mt-1 text-xs font-bold text-neutral-500">IP: {log.ip_address || "Not available"}</div></td>
                  <td className="rounded-r-2xl border-y border-r border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                    <button
                      type="button"
                      onClick={() => clearAttendanceLogs("single", { logId: log.id })}
                      disabled={clearingLogs === `single:${log.id}`}
                      className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black uppercase text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {clearingLogs === `single:${log.id}` ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>;
              })}
            </tbody></table></div>
          )}
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
              Photo URL is stored in Supabase attendance-photos bucket. Use this preview for quick admin verification.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
