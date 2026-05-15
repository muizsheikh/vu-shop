import { NextRequest, NextResponse } from "next/server";
import { getAdminUserFromRequest } from "@/lib/adminAuth";
import { canManageUsers, canViewReports } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type DateFilter = "today" | "yesterday" | "last_7_days" | "last_30_days" | "all_time";

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function startOfDay(date: Date) {
  const cloned = new Date(date);
  cloned.setHours(0, 0, 0, 0);
  return cloned;
}

function endOfDay(date: Date) {
  const cloned = new Date(date);
  cloned.setHours(23, 59, 59, 999);
  return cloned;
}

function normalizeDateFilter(value: string | null): DateFilter {
  const clean = String(value || "today").trim().toLowerCase();

  if (
    clean === "today" ||
    clean === "yesterday" ||
    clean === "last_7_days" ||
    clean === "last_30_days" ||
    clean === "all_time"
  ) {
    return clean as DateFilter;
  }

  return "today";
}

function getDateRange(filter: DateFilter) {
  const now = new Date();

  if (filter === "today") {
    return {
      from: startOfDay(now).toISOString().slice(0, 10),
      to: endOfDay(now).toISOString().slice(0, 10),
    };
  }

  if (filter === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    return {
      from: startOfDay(yesterday).toISOString().slice(0, 10),
      to: endOfDay(yesterday).toISOString().slice(0, 10),
    };
  }

  if (filter === "last_7_days") {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - 6);

    return {
      from: start.toISOString().slice(0, 10),
      to: endOfDay(now).toISOString().slice(0, 10),
    };
  }

  if (filter === "last_30_days") {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - 29);

    return {
      from: start.toISOString().slice(0, 10),
      to: endOfDay(now).toISOString().slice(0, 10),
    };
  }

  return {
    from: null,
    to: null,
  };
}

function cleanSearchValue(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/[,%]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminUserFromRequest(req);

    if (!admin.ok) {
      return jsonResponse({ error: admin.message }, admin.status);
    }

    if (!canViewReports(admin.user.role) && !canManageUsers(admin.user.role)) {
      return jsonResponse(
        { error: "You do not have permission to view attendance logs." },
        403
      );
    }

    const { searchParams } = new URL(req.url);

    const search = cleanSearchValue(searchParams.get("search"));
    const branch = String(searchParams.get("branch") || "").trim();
    const dateFilter = normalizeDateFilter(searchParams.get("date"));
    const range = getDateRange(dateFilter);

    let query = supabaseAdmin
      .from("employee_attendance_logs")
      .select(
        `
        id,
        employee_id,
        user_id,
        attendance_date,
        check_in_at,
        check_out_at,
        check_in_latitude,
        check_in_longitude,
        check_out_latitude,
        check_out_longitude,
        check_in_distance_meters,
        check_out_distance_meters,
        check_in_within_radius,
        check_out_within_radius,
        check_in_photo_url,
        check_out_photo_url,
        detected_branch_id,
        detected_branch_name,
        branch_distance_meters,
        branch_within_radius,
        status,
        branch_name,
        device_info,
        ip_address,
        erp_sync_status,
        erp_attendance_id,
        erp_error,
        admin_note,
        created_at,
        updated_at,
        admin_employees (
          id,
          employee_name,
          employee_email,
          employee_phone,
          branch_name,
          designation,
          erp_employee_id,
          allowed_radius_meters
        )
      `
      )
      .order("attendance_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);

    if (range.from) {
      query = query.gte("attendance_date", range.from);
    }

    if (range.to) {
      query = query.lte("attendance_date", range.to);
    }

    if (branch) {
      query = query.eq("branch_name", branch);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message || "Failed to load attendance logs.");
    }

    let logs = Array.isArray(data) ? data : [];

    if (search) {
      const needle = search.toLowerCase();

      logs = logs.filter((log: any) => {
        const employee = Array.isArray(log.admin_employees)
          ? log.admin_employees[0] || {}
          : log.admin_employees || {};

        const haystack = [
          employee.employee_name,
          employee.employee_email,
          employee.employee_phone,
          employee.designation,
          employee.erp_employee_id,
          log.branch_name,
          log.detected_branch_name,
          log.status,
          log.erp_sync_status,
        ]
          .map((value) => String(value || "").toLowerCase())
          .join(" ");

        return haystack.includes(needle);
      });
    }

    const summary = {
      total: logs.length,
      checked_in: logs.filter((log: any) => Boolean(log.check_in_at)).length,
      checked_out: logs.filter((log: any) => Boolean(log.check_out_at)).length,
      open: logs.filter((log: any) => Boolean(log.check_in_at) && !log.check_out_at)
        .length,
      outside_radius: logs.filter(
        (log: any) =>
          log.branch_within_radius === false ||
          log.check_in_within_radius === false ||
          log.check_out_within_radius === false
      ).length,
      erp_pending: logs.filter((log: any) => log.erp_sync_status === "pending").length,
      erp_synced: logs.filter((log: any) => log.erp_sync_status === "synced").length,
      branches: Array.from(
        new Set(
          logs
            .map((log: any) => log.detected_branch_name || log.branch_name)
            .filter(Boolean)
        )
      ),
      with_check_in_photo: logs.filter((log: any) => Boolean(log.check_in_photo_url))
        .length,
      with_check_out_photo: logs.filter((log: any) => Boolean(log.check_out_photo_url))
        .length,
    };

    return jsonResponse({
      admin: admin.user,
      logs,
      summary,
      filters: {
        search,
        branch,
        date: dateFilter,
      },
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "Failed to load attendance logs." },
      500
    );
  }
}
