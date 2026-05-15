import { NextRequest, NextResponse } from "next/server";
import { getAdminUserFromRequest } from "@/lib/adminAuth";
import { canManageUsers } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type BranchPayload = {
  branch_name?: string;
  branch_code?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  allowed_radius_meters?: number | string | null;
  is_active?: boolean;
  notes?: string | null;
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

function buildBranchResponse(branch: any) {
  return {
    id: branch.id,
    branch_name: branch.branch_name,
    branch_code: branch.branch_code || null,
    latitude: branch.latitude,
    longitude: branch.longitude,
    allowed_radius_meters: branch.allowed_radius_meters,
    is_active: branch.is_active !== false,
    notes: branch.notes || null,
    created_at: branch.created_at,
    updated_at: branch.updated_at,
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
        { error: "You do not have permission to manage branch locations." },
        403
      );
    }

    const { id } = await context.params;
    const branchId = String(id || "").trim();

    if (!branchId) {
      return jsonResponse({ error: "Branch ID is required." }, 400);
    }

    const { data, error } = await supabaseAdmin
      .from("admin_branch_locations")
      .select(
        "id, branch_name, branch_code, latitude, longitude, allowed_radius_meters, is_active, notes, created_at, updated_at"
      )
      .eq("id", branchId)
      .single();

    if (error || !data) {
      return jsonResponse(
        { error: error?.message || "Branch location not found." },
        404
      );
    }

    return jsonResponse({
      admin: admin.user,
      branch: buildBranchResponse(data),
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "Failed to load branch location." },
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
        { error: "You do not have permission to update branch locations." },
        403
      );
    }

    const { id } = await context.params;
    const branchId = String(id || "").trim();

    if (!branchId) {
      return jsonResponse({ error: "Branch ID is required." }, 400);
    }

    const body = (await req.json().catch(() => ({}))) as BranchPayload;

    const branchName = cleanRequiredText(body.branch_name);

    if (!branchName) {
      return jsonResponse({ error: "Branch name is required." }, 400);
    }

    const latitude = cleanLatitude(body.latitude);
    const longitude = cleanLongitude(body.longitude);

    if (latitude === "INVALID_LATITUDE") {
      return jsonResponse({ error: "Invalid latitude value." }, 400);
    }

    if (longitude === "INVALID_LONGITUDE") {
      return jsonResponse({ error: "Invalid longitude value." }, 400);
    }

    const updatePayload = {
      branch_name: branchName,
      branch_code: cleanText(body.branch_code),
      latitude,
      longitude,
      allowed_radius_meters: cleanRadius(body.allowed_radius_meters),
      is_active: body.is_active !== false,
      notes: cleanText(body.notes),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("admin_branch_locations")
      .update(updatePayload)
      .eq("id", branchId)
      .select(
        "id, branch_name, branch_code, latitude, longitude, allowed_radius_meters, is_active, notes, created_at, updated_at"
      )
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Failed to update branch location.");
    }

    return jsonResponse({
      admin: admin.user,
      branch: buildBranchResponse(data),
      message: "Branch location updated successfully.",
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "Failed to update branch location." },
      500
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getAdminUserFromRequest(req);

    if (!admin.ok) {
      return jsonResponse({ error: admin.message }, admin.status);
    }

    if (!canManageUsers(admin.user.role)) {
      return jsonResponse(
        { error: "You do not have permission to delete branch locations." },
        403
      );
    }

    const { id } = await context.params;
    const branchId = String(id || "").trim();

    if (!branchId) {
      return jsonResponse({ error: "Branch ID is required." }, 400);
    }

    const { data: branch, error: branchError } = await supabaseAdmin
      .from("admin_branch_locations")
      .select("id, branch_name")
      .eq("id", branchId)
      .single();

    if (branchError || !branch) {
      return jsonResponse(
        { error: branchError?.message || "Branch location not found." },
        404
      );
    }

    const { error } = await supabaseAdmin
      .from("admin_branch_locations")
      .delete()
      .eq("id", branchId);

    if (error) {
      throw new Error(error.message || "Failed to delete branch location.");
    }

    return jsonResponse({
      admin: admin.user,
      deleted_branch: branch,
      message: "Branch location deleted successfully.",
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "Failed to delete branch location." },
      500
    );
  }
}