import { NextRequest, NextResponse } from "next/server";
import { getAdminUserFromRequest } from "@/lib/adminAuth";
import { canManageUsers, canViewReports } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminUserFromRequest(req);

    if (!admin.ok) {
      return jsonResponse({ error: admin.message }, admin.status);
    }

    if (!canViewReports(admin.user.role) && !canManageUsers(admin.user.role)) {
      return jsonResponse(
        { error: "You do not have permission to view branch locations." },
        403
      );
    }

    const { searchParams } = new URL(req.url);
    const search = String(searchParams.get("search") || "").trim();
    const active = String(searchParams.get("active") || "all")
      .trim()
      .toLowerCase();

    let query = supabaseAdmin
      .from("admin_branch_locations")
      .select(
        "id, branch_name, branch_code, latitude, longitude, allowed_radius_meters, is_active, notes, created_at, updated_at"
      )
      .order("branch_name", { ascending: true });

    if (search) {
      const needle = `%${search.replace(/[,%]/g, " ")}%`;

      query = query.or(
        [
          `branch_name.ilike.${needle}`,
          `branch_code.ilike.${needle}`,
          `notes.ilike.${needle}`,
        ].join(",")
      );
    }

    if (active === "active") {
      query = query.eq("is_active", true);
    }

    if (active === "inactive") {
      query = query.eq("is_active", false);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message || "Failed to load branch locations.");
    }

    const branches = Array.isArray(data) ? data : [];

    return jsonResponse({
      admin: admin.user,
      branches,
      summary: {
        total: branches.length,
        active: branches.filter((branch: any) => branch.is_active).length,
        inactive: branches.filter((branch: any) => !branch.is_active).length,
        with_location: branches.filter(
          (branch: any) => branch.latitude !== null && branch.longitude !== null
        ).length,
        missing_location: branches.filter(
          (branch: any) => branch.latitude === null || branch.longitude === null
        ).length,
      },
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "Failed to load branch locations." },
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
        { error: "You do not have permission to manage branch locations." },
        403
      );
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

    const payload = {
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
      .upsert(payload, {
        onConflict: "branch_name",
      })
      .select(
        "id, branch_name, branch_code, latitude, longitude, allowed_radius_meters, is_active, notes, created_at, updated_at"
      )
      .single();

    if (error) {
      throw new Error(error.message || "Failed to save branch location.");
    }

    return jsonResponse({
      admin: admin.user,
      branch: data,
      message: "Branch location saved successfully.",
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "Failed to save branch location." },
      500
    );
  }
}