import { NextRequest, NextResponse } from "next/server";
import { getAdminUserFromRequest } from "@/lib/adminAuth";
import { canManageUsers, canViewReports } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type EmployeePayload = {
  user_id?: string | null;
  erp_employee_id?: string | null;
  employee_name?: string;
  employee_email?: string | null;
  employee_phone?: string | null;
  branch_name?: string;
  designation?: string | null;
  allowed_latitude?: number | null;
  allowed_longitude?: number | null;
  allowed_radius_meters?: number | null;
  notes?: string | null;
  is_active?: boolean;
};

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

function cleanRadius(value: unknown) {
  const radius = Number(value || 150);

  if (!Number.isFinite(radius)) return 150;

  return Math.min(5000, Math.max(20, Math.floor(radius)));
}

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminUserFromRequest(req);

    if (!admin.ok) {
      return jsonResponse({ error: admin.message }, admin.status);
    }

    if (!canViewReports(admin.user.role) && !canManageUsers(admin.user.role)) {
      return jsonResponse(
        { error: "You do not have permission to view employees." },
        403
      );
    }

    const { searchParams } = new URL(req.url);
    const search = String(searchParams.get("search") || "").trim();
    const branch = String(searchParams.get("branch") || "").trim();
    const active = String(searchParams.get("active") || "all").trim().toLowerCase();

    let query = supabaseAdmin
      .from("admin_employees")
      .select(
        "id, user_id, erp_employee_id, employee_name, employee_email, employee_phone, branch_name, designation, allowed_latitude, allowed_longitude, allowed_radius_meters, is_active, notes, created_at, updated_at"
      )
      .order("created_at", { ascending: false });

    if (search) {
      const needle = `%${search.replace(/[,%]/g, " ")}%`;

      query = query.or(
        [
          `employee_name.ilike.${needle}`,
          `employee_email.ilike.${needle}`,
          `employee_phone.ilike.${needle}`,
          `branch_name.ilike.${needle}`,
          `designation.ilike.${needle}`,
          `erp_employee_id.ilike.${needle}`,
        ].join(",")
      );
    }

    if (branch) {
      query = query.eq("branch_name", branch);
    }

    if (active === "active") {
      query = query.eq("is_active", true);
    }

    if (active === "inactive") {
      query = query.eq("is_active", false);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message || "Failed to load employees.");
    }

    const employees = Array.isArray(data) ? data : [];

    return jsonResponse({
      admin: admin.user,
      employees,
      summary: {
        total: employees.length,
        active: employees.filter((employee: any) => employee.is_active).length,
        inactive: employees.filter((employee: any) => !employee.is_active).length,
        branches: Array.from(
          new Set(
            employees
              .map((employee: any) => employee.branch_name)
              .filter(Boolean)
          )
        ),
      },
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "Failed to load employees." },
      500
    );
  }
}

export async function POST(req: NextRequest) {
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

    const body = (await req.json().catch(() => ({}))) as EmployeePayload;

    const employeeName = cleanRequiredText(body.employee_name);
    const branchName = cleanRequiredText(body.branch_name);

    if (!employeeName) {
      return jsonResponse({ error: "Employee name is required." }, 400);
    }

    if (!branchName) {
      return jsonResponse({ error: "Branch name is required." }, 400);
    }

    const latitude = cleanNumber(body.allowed_latitude);
    const longitude = cleanNumber(body.allowed_longitude);

    const payload = {
      user_id: cleanText(body.user_id),
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

    const { data, error } = await supabaseAdmin
      .from("admin_employees")
      .insert(payload)
      .select(
        "id, user_id, erp_employee_id, employee_name, employee_email, employee_phone, branch_name, designation, allowed_latitude, allowed_longitude, allowed_radius_meters, is_active, notes, created_at, updated_at"
      )
      .single();

    if (error) {
      throw new Error(error.message || "Failed to create employee.");
    }

    return jsonResponse({
      admin: admin.user,
      employee: data,
      message: "Employee created successfully.",
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "Failed to create employee." },
      500
    );
  }
}