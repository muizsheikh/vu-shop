import { NextRequest, NextResponse } from "next/server";
import { getAdminUserFromRequest } from "@/lib/adminAuth";
import { canManageUsers } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type EmployeePayload = {
  user_id?: string | null;
  erp_employee_id?: string | null;
  employee_name?: string;
  employee_email?: string | null;
  employee_phone?: string | null;
  branch_name?: string;
  designation?: string | null;
  allowed_latitude?: number | string | null;
  allowed_longitude?: number | string | null;
  allowed_radius_meters?: number | string | null;
  notes?: string | null;
  is_active?: boolean;
};

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function cleanText(value: unknown) {
  const text = String(value || "").trim();
  return text.length ? text : null;
}

function cleanRequiredText(value: unknown) {
  return String(value || "").trim();
}

function cleanNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);

  if (!Number.isFinite(number)) return null;

  return number;
}

function cleanLatitude(value: unknown) {
  const number = cleanNumber(value);

  if (number === null) return null;

  if (number < -90 || number > 90) return "INVALID_LATITUDE";

  return number;
}

function cleanLongitude(value: unknown) {
  const number = cleanNumber(value);

  if (number === null) return null;

  if (number < -180 || number > 180) return "INVALID_LONGITUDE";

  return number;
}

function cleanRadius(value: unknown) {
  const radius = Number(value || 150);

  if (!Number.isFinite(radius)) return 150;

  return Math.min(5000, Math.max(20, Math.floor(radius)));
}

function hasOwn(object: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function buildEmployeeResponse(employee: any) {
  return {
    id: employee.id,
    user_id: employee.user_id || null,
    erp_employee_id: employee.erp_employee_id || null,
    employee_name: employee.employee_name,
    employee_email: employee.employee_email || null,
    employee_phone: employee.employee_phone || null,
    branch_name: employee.branch_name,
    designation: employee.designation || null,
    allowed_latitude: employee.allowed_latitude,
    allowed_longitude: employee.allowed_longitude,
    allowed_radius_meters: employee.allowed_radius_meters,
    is_active: employee.is_active !== false,
    notes: employee.notes || null,
    created_at: employee.created_at,
    updated_at: employee.updated_at,
  };
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getAdminUserFromRequest(req);

    if (!admin.ok) {
      return jsonResponse({ error: admin.message }, admin.status);
    }

    if (!canManageUsers(admin.user.role)) {
      return jsonResponse(
        { error: "You do not have permission to manage employees." },
        403
      );
    }

    const { id } = await context.params;
    const employeeId = String(id || "").trim();

    if (!employeeId) {
      return jsonResponse({ error: "Employee ID is required." }, 400);
    }

    const { data, error } = await supabaseAdmin
      .from("admin_employees")
      .select(
        "id, user_id, erp_employee_id, employee_name, employee_email, employee_phone, branch_name, designation, allowed_latitude, allowed_longitude, allowed_radius_meters, is_active, notes, created_at, updated_at"
      )
      .eq("id", employeeId)
      .single();

    if (error || !data) {
      return jsonResponse(
        { error: error?.message || "Employee not found." },
        404
      );
    }

    return jsonResponse({
      admin: admin.user,
      employee: buildEmployeeResponse(data),
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "Failed to load employee." },
      500
    );
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getAdminUserFromRequest(req);

    if (!admin.ok) {
      return jsonResponse({ error: admin.message }, admin.status);
    }

    if (!canManageUsers(admin.user.role)) {
      return jsonResponse(
        { error: "You do not have permission to update employees." },
        403
      );
    }

    const { id } = await context.params;
    const employeeId = String(id || "").trim();

    if (!employeeId) {
      return jsonResponse({ error: "Employee ID is required." }, 400);
    }

    const body = (await req.json().catch(() => ({}))) as EmployeePayload;
    const rawBody = body as Record<string, unknown>;

    const employeeName = cleanRequiredText(body.employee_name);
    const branchName = cleanRequiredText(body.branch_name);

    if (!employeeName) {
      return jsonResponse({ error: "Employee name is required." }, 400);
    }

    if (!branchName) {
      return jsonResponse({ error: "Branch name is required." }, 400);
    }

    const latitude = cleanLatitude(body.allowed_latitude);
    const longitude = cleanLongitude(body.allowed_longitude);

    if (latitude === "INVALID_LATITUDE") {
      return jsonResponse({ error: "Invalid latitude value." }, 400);
    }

    if (longitude === "INVALID_LONGITUDE") {
      return jsonResponse({ error: "Invalid longitude value." }, 400);
    }

    const updatePayload: Record<string, unknown> = {
      erp_employee_id: cleanText(body.erp_employee_id),
      employee_name: employeeName,
      employee_email: cleanText(body.employee_email),
      employee_phone: cleanText(body.employee_phone),
      branch_name: branchName,
      designation: cleanText(body.designation),
      allowed_latitude: latitude,
      allowed_longitude: longitude,
      allowed_radius_meters: cleanRadius(body.allowed_radius_meters),
      is_active: body.is_active !== false,
      notes: cleanText(body.notes),
      updated_at: new Date().toISOString(),
    };

    // Important: user_id is managed by the separate employee-user link API.
    // Only update it from this route when the frontend intentionally sends user_id.
    // This prevents normal employee edit from accidentally unlinking login accounts.
    if (hasOwn(rawBody, "user_id")) {
      updatePayload.user_id = cleanText(body.user_id);
    }

    const { data, error } = await supabaseAdmin
      .from("admin_employees")
      .update(updatePayload)
      .eq("id", employeeId)
      .select(
        "id, user_id, erp_employee_id, employee_name, employee_email, employee_phone, branch_name, designation, allowed_latitude, allowed_longitude, allowed_radius_meters, is_active, notes, created_at, updated_at"
      )
      .single();

    if (error || !data) {
      return jsonResponse(
        { error: error?.message || "Employee update failed." },
        500
      );
    }

    return jsonResponse({
      admin: admin.user,
      employee: buildEmployeeResponse(data),
      message: "Employee updated successfully.",
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "Failed to update employee." },
      500
    );
  }
}
