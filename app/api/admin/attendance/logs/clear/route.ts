import { NextRequest, NextResponse } from "next/server";
import { getAdminUserFromRequest } from "@/lib/adminAuth";
import { canManageUsers } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ClearPayload = {
  mode?: "today" | "date" | "all" | "single" | "employee";
  date?: string;
  log_id?: string;
  employee_id?: string;
};

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime());
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminUserFromRequest(req);

    if (!admin.ok) {
      return jsonResponse({ error: admin.message }, admin.status);
    }

    if (!canManageUsers(admin.user.role)) {
      return jsonResponse(
        { error: "You do not have permission to clear attendance logs." },
        403
      );
    }

    const body = (await req.json().catch(() => ({}))) as ClearPayload;
    const mode = body.mode || "today";

    if (mode === "single") {
      const logId = cleanText(body.log_id);

      if (!logId) {
        return jsonResponse({ error: "Log ID is required." }, 400);
      }

      const { error } = await supabaseAdmin
        .from("employee_attendance_logs")
        .delete()
        .eq("id", logId);

      if (error) {
        throw new Error(error.message || "Failed to delete attendance log.");
      }

      return jsonResponse({
        message: "Attendance log deleted successfully.",
        mode,
      });
    }

    if (mode === "employee") {
      const employeeId = cleanText(body.employee_id);

      if (!employeeId) {
        return jsonResponse({ error: "Employee ID is required." }, 400);
      }

      const { error } = await supabaseAdmin
        .from("employee_attendance_logs")
        .delete()
        .eq("employee_id", employeeId);

      if (error) {
        throw new Error(
          error.message || "Failed to clear employee attendance logs."
        );
      }

      return jsonResponse({
        message: "Employee attendance logs cleared successfully.",
        mode,
      });
    }

    if (mode === "date") {
      const date = cleanText(body.date);

      if (!date || !isValidDate(date)) {
        return jsonResponse(
          { error: "Valid date is required in YYYY-MM-DD format." },
          400
        );
      }

      const { error } = await supabaseAdmin
        .from("employee_attendance_logs")
        .delete()
        .eq("attendance_date", date);

      if (error) {
        throw new Error(
          error.message || "Failed to clear attendance logs for date."
        );
      }

      return jsonResponse({
        message: `Attendance logs cleared for ${date}.`,
        mode,
        date,
      });
    }

    if (mode === "all") {
      const { searchParams } = new URL(req.url);
      const confirm = searchParams.get("confirm");

      if (confirm !== "CLEAR_ALL_ATTENDANCE_LOGS") {
        return jsonResponse(
          {
            error:
              "Clear all requires confirmation query: ?confirm=CLEAR_ALL_ATTENDANCE_LOGS",
          },
          400
        );
      }

      const { error } = await supabaseAdmin
        .from("employee_attendance_logs")
        .delete()
        .not("id", "is", null);

      if (error) {
        throw new Error(error.message || "Failed to clear all attendance logs.");
      }

      return jsonResponse({
        message: "All attendance logs cleared successfully.",
        mode,
      });
    }

    const today = getTodayDate();

    const { error } = await supabaseAdmin
      .from("employee_attendance_logs")
      .delete()
      .eq("attendance_date", today);

    if (error) {
      throw new Error(error.message || "Failed to clear today's logs.");
    }

    return jsonResponse({
      message: "Today's attendance logs cleared successfully.",
      mode: "today",
      date: today,
    });
  } catch (error: any) {
    return jsonResponse(
      {
        error: error?.message || "Failed to clear attendance logs.",
      },
      500
    );
  }
}