import { NextRequest, NextResponse } from "next/server";
import { getAdminUserFromRequest } from "@/lib/adminAuth";
import { canManageUsers } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type LinkPayload = {
  user_id?: string | null;
};

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function cleanText(value: unknown) {
  const text = String(value || "").trim();
  return text.length ? text : null;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getAdminUserFromRequest(req);

    if (!admin.ok) {
      return jsonResponse({ error: admin.message }, admin.status);
    }

    if (!canManageUsers(admin.user.role)) {
      return jsonResponse(
        { error: "You do not have permission to link employee users." },
        403
      );
    }

    const { id } = await context.params;
    const employeeId = cleanText(id);

    if (!employeeId) {
      return jsonResponse({ error: "Employee ID is required." }, 400);
    }

    const body = (await req.json().catch(() => ({}))) as LinkPayload;
    const userId = cleanText(body.user_id);

    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("admin_employees")
      .select("id, employee_name, employee_email, user_id")
      .eq("id", employeeId)
      .single();

    if (employeeError || !employee) {
      return jsonResponse(
        { error: employeeError?.message || "Employee not found." },
        404
      );
    }

    if (userId) {
      const { data: userResult, error: userError } =
        await supabaseAdmin.auth.admin.getUserById(userId);

      if (userError || !userResult?.user) {
        return jsonResponse(
          { error: userError?.message || "Selected user account not found." },
          404
        );
      }

      const { data: alreadyLinked, error: linkedError } = await supabaseAdmin
        .from("admin_employees")
        .select("id, employee_name, employee_email")
        .eq("user_id", userId)
        .neq("id", employeeId)
        .maybeSingle();

      if (linkedError) {
        throw new Error(linkedError.message || "Failed to validate user link.");
      }

      if (alreadyLinked) {
        return jsonResponse(
          {
            error: `This user is already linked with ${alreadyLinked.employee_name}.`,
          },
          400
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from("admin_employees")
      .update({
        user_id: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", employeeId)
      .select(
        "id, user_id, erp_employee_id, employee_name, employee_email, employee_phone, branch_name, designation, allowed_latitude, allowed_longitude, allowed_radius_meters, is_active, notes, created_at, updated_at"
      )
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Failed to update employee user link.");
    }

    return jsonResponse({
      admin: admin.user,
      employee: data,
      message: userId
        ? "Employee linked with user account successfully."
        : "Employee user link removed successfully.",
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "Failed to update employee user link." },
      500
    );
  }
}