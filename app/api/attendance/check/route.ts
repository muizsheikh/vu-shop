import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const authClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

type CheckPayload = {
  latitude?: number;
  longitude?: number;
  action?: "auto" | "check_in" | "check_out";
  photo_url?: string | null;
  check_in_photo_url?: string | null;
  check_out_photo_url?: string | null;
};

type BranchLocation = {
  id: string;
  branch_name: string;
  branch_code: string | null;
  latitude: number | null;
  longitude: number | null;
  allowed_radius_meters: number | null;
  is_active: boolean;
};

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function cleanNumber(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number)) return null;

  return number;
}

function cleanText(value: unknown) {
  const text = String(value || "").trim();
  return text.length ? text : null;
}

function cleanPhotoUrl(value: unknown) {
  const text = cleanText(value);

  if (!text) return null;

  if (!text.startsWith("https://") && !text.startsWith("http://")) {
    return null;
  }

  if (text.length > 2000) {
    return null;
  }

  return text;
}

function getTodayDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getClientIp(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "";

  return ip.slice(0, 120);
}

function getDeviceInfo(req: NextRequest) {
  return String(req.headers.get("user-agent") || "").slice(0, 500);
}

function normalizeAction(value: unknown): "auto" | "check_in" | "check_out" | null {
  const action = String(value || "auto").trim().toLowerCase();

  if (action === "auto" || action === "check_in" || action === "check_out") {
    return action as "auto" | "check_in" | "check_out";
  }

  return null;
}

function normalizeForCompare(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function buildAdminNote(parts: Array<string | null | undefined>) {
  const uniqueParts = Array.from(
    new Set(
      parts
        .map((part) => String(part || "").trim())
        .filter(Boolean)
    )
  );

  return uniqueParts.length ? uniqueParts.join("\n") : null;
}

function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadiusMeters = 6371000;
  const toRadians = (degree: number) => (degree * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(earthRadiusMeters * c);
}

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return {
      ok: false as const,
      status: 401,
      message: "Missing authorization token.",
      user: null,
    };
  }

  const { data, error } = await authClient.auth.getUser(token);

  if (error || !data.user) {
    return {
      ok: false as const,
      status: 401,
      message: "Invalid or expired session.",
      user: null,
    };
  }

  return {
    ok: true as const,
    status: 200,
    message: "OK",
    user: data.user,
  };
}

async function detectNearestBranch(latitude: number, longitude: number) {
  const { data, error } = await supabaseAdmin
    .from("admin_branch_locations")
    .select(
      "id, branch_name, branch_code, latitude, longitude, allowed_radius_meters, is_active"
    )
    .eq("is_active", true)
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (error) {
    throw new Error(error.message || "Failed to load branch locations.");
  }

  const branches = Array.isArray(data) ? (data as BranchLocation[]) : [];

  if (branches.length === 0) {
    return null;
  }

  const rankedBranches = branches
    .map((branch) => {
      const branchLatitude = cleanNumber(branch.latitude);
      const branchLongitude = cleanNumber(branch.longitude);
      const radius = Number(branch.allowed_radius_meters || 150);

      if (branchLatitude === null || branchLongitude === null) {
        return null;
      }

      const distance = calculateDistanceMeters(
        branchLatitude,
        branchLongitude,
        latitude,
        longitude
      );

      return {
        branch,
        distance_meters: distance,
        allowed_radius_meters: radius,
        within_radius: distance <= radius,
      };
    })
    .filter(Boolean) as {
    branch: BranchLocation;
    distance_meters: number;
    allowed_radius_meters: number;
    within_radius: boolean;
  }[];

  if (rankedBranches.length === 0) {
    return null;
  }

  rankedBranches.sort((a, b) => a.distance_meters - b.distance_meters);

  return rankedBranches[0];
}

function getEmployeeFallbackLocation(employee: any, latitude: number, longitude: number) {
  const allowedLatitude = cleanNumber(employee.allowed_latitude);
  const allowedLongitude = cleanNumber(employee.allowed_longitude);
  const allowedRadius = Number(employee.allowed_radius_meters || 150);

  if (allowedLatitude === null || allowedLongitude === null) {
    return {
      distance_meters: null as number | null,
      allowed_radius_meters: allowedRadius,
      within_radius: null as boolean | null,
    };
  }

  const distance = calculateDistanceMeters(
    allowedLatitude,
    allowedLongitude,
    latitude,
    longitude
  );

  return {
    distance_meters: distance,
    allowed_radius_meters: allowedRadius,
    within_radius: distance <= allowedRadius,
  };
}

function getPhotoUrlForAction(body: CheckPayload, action: "check_in" | "check_out") {
  if (action === "check_in") {
    return (
      cleanPhotoUrl(body.check_in_photo_url) ||
      cleanPhotoUrl(body.photo_url)
    );
  }

  return (
    cleanPhotoUrl(body.check_out_photo_url) ||
    cleanPhotoUrl(body.photo_url)
  );
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);

    if (!auth.ok || !auth.user) {
      return jsonResponse({ error: auth.message }, auth.status);
    }

    const userId = auth.user.id;
    const today = getTodayDate();

    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("admin_employees")
      .select(
        "id, user_id, erp_employee_id, employee_name, employee_email, employee_phone, branch_name, designation, allowed_latitude, allowed_longitude, allowed_radius_meters, is_active, notes, created_at, updated_at"
      )
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (employeeError) {
      throw new Error(employeeError.message || "Failed to load employee.");
    }

    if (!employee) {
      return jsonResponse(
        {
          error:
            "No active employee profile is linked with this account. Please contact admin.",
        },
        404
      );
    }

    const { data: attendance, error: attendanceError } = await supabaseAdmin
      .from("employee_attendance_logs")
      .select("*")
      .eq("employee_id", employee.id)
      .eq("attendance_date", today)
      .maybeSingle();

    if (attendanceError) {
      throw new Error(
        attendanceError.message || "Failed to load attendance status."
      );
    }

    return jsonResponse({
      employee,
      attendance,
      status: {
        date: today,
        has_checked_in: Boolean(attendance?.check_in_at),
        has_checked_out: Boolean(attendance?.check_out_at),
        next_action: !attendance?.check_in_at
          ? "check_in"
          : attendance?.check_out_at
          ? "completed"
          : "check_out",
      },
    });
  } catch (error: any) {
    return jsonResponse(
      {
        error: error?.message || "Failed to load attendance status.",
      },
      500
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);

    if (!auth.ok || !auth.user) {
      return jsonResponse({ error: auth.message }, auth.status);
    }

    const body = (await req.json().catch(() => ({}))) as CheckPayload;

    const latitude = cleanNumber(body.latitude);
    const longitude = cleanNumber(body.longitude);
    const requestedAction = normalizeAction(body.action);

    if (!requestedAction) {
      return jsonResponse(
        {
          error: "Invalid attendance action.",
        },
        400
      );
    }

    if (latitude === null || longitude === null) {
      return jsonResponse(
        {
          error: "Latitude and longitude are required for attendance.",
        },
        400
      );
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return jsonResponse(
        {
          error: "Invalid geo location values.",
        },
        400
      );
    }

    const userId = auth.user.id;
    const today = getTodayDate();
    const now = new Date().toISOString();

    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("admin_employees")
      .select(
        "id, user_id, erp_employee_id, employee_name, employee_email, employee_phone, branch_name, designation, allowed_latitude, allowed_longitude, allowed_radius_meters, is_active, notes, created_at, updated_at"
      )
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (employeeError) {
      throw new Error(employeeError.message || "Failed to load employee.");
    }

    if (!employee) {
      return jsonResponse(
        {
          error:
            "No active employee profile is linked with this account. Please contact admin.",
        },
        404
      );
    }

    const nearestBranch = await detectNearestBranch(latitude, longitude);
    const fallbackLocation = getEmployeeFallbackLocation(
      employee,
      latitude,
      longitude
    );

    const detectedBranch = nearestBranch?.branch || null;
    const distanceMeters =
      nearestBranch?.distance_meters ?? fallbackLocation.distance_meters;
    const allowedRadius =
      nearestBranch?.allowed_radius_meters ??
      fallbackLocation.allowed_radius_meters;
    const withinRadius =
      nearestBranch?.within_radius ?? fallbackLocation.within_radius;

    const detectedBranchId = detectedBranch?.id || null;
    const detectedBranchName = detectedBranch?.branch_name || null;
    const logBranchName = detectedBranchName || employee.branch_name;

    const { data: existingLog, error: existingError } = await supabaseAdmin
      .from("employee_attendance_logs")
      .select("*")
      .eq("employee_id", employee.id)
      .eq("attendance_date", today)
      .maybeSingle();

    if (existingError) {
      throw new Error(
        existingError.message || "Failed to load today's attendance."
      );
    }

    let action: "check_in" | "check_out";

    if (requestedAction === "check_in") {
      action = "check_in";
    } else if (requestedAction === "check_out") {
      action = "check_out";
    } else if (!existingLog?.check_in_at) {
      action = "check_in";
    } else if (!existingLog?.check_out_at) {
      action = "check_out";
    } else {
      return jsonResponse(
        {
          error: "Your attendance is already completed for today.",
          attendance: existingLog,
          employee,
        },
        400
      );
    }

    const clientIp = getClientIp(req);
    const deviceInfo = getDeviceInfo(req);
    const photoUrl = getPhotoUrlForAction(body, action);

    if (!photoUrl) {
      return jsonResponse(
        {
          error: `Photo is required for ${
            action === "check_in" ? "check-in" : "check-out"
          }.`,
        },
        400
      );
    }

    if (action === "check_in" && existingLog?.check_in_at) {
      return jsonResponse(
        {
          error: "You have already checked in today.",
          attendance: existingLog,
          employee,
        },
        400
      );
    }

    if (action === "check_out" && !existingLog?.check_in_at) {
      return jsonResponse(
        {
          error: "Please check in first before check-out.",
          attendance: existingLog,
          employee,
        },
        400
      );
    }

    if (action === "check_out" && existingLog?.check_out_at) {
      return jsonResponse(
        {
          error: "You have already checked out today.",
          attendance: existingLog,
          employee,
        },
        400
      );
    }

    if (action === "check_in") {
      const adminNote = buildAdminNote([
        withinRadius === false
          ? `SECURITY WARNING: Check-in outside allowed radius. Distance: ${
              distanceMeters ?? "not available"
            }m, allowed radius: ${allowedRadius ?? "not available"}m.`
          : null,
        !detectedBranchName
          ? "SECURITY NOTE: No active branch location detected. Employee fallback location was used if available."
          : null,
      ]);

      const payload = {
        employee_id: employee.id,
        user_id: userId,
        attendance_date: today,
        check_in_at: now,
        check_in_latitude: latitude,
        check_in_longitude: longitude,
        check_in_distance_meters: distanceMeters,
        check_in_within_radius: withinRadius,
        check_in_photo_url: photoUrl,
        status: "present",
        branch_name: logBranchName,
        detected_branch_id: detectedBranchId,
        detected_branch_name: detectedBranchName,
        branch_distance_meters: distanceMeters,
        branch_within_radius: withinRadius,
        device_info: deviceInfo,
        ip_address: clientIp,
        erp_sync_status: "pending",
        admin_note: adminNote,
        updated_at: now,
      };

      const { data: attendance, error: insertError } = await supabaseAdmin
        .from("employee_attendance_logs")
        .insert(payload)
        .select("*")
        .single();

      if (insertError) {
        const message = String(insertError.message || "");

        if (message.toLowerCase().includes("duplicate")) {
          return jsonResponse(
            {
              error: "You have already checked in today.",
              employee,
            },
            400
          );
        }

        throw new Error(insertError.message || "Check-in failed.");
      }

      return jsonResponse({
        employee,
        attendance,
        action: "check_in",
        detected_branch: detectedBranch
          ? {
              id: detectedBranch.id,
              branch_name: detectedBranch.branch_name,
              branch_code: detectedBranch.branch_code,
            }
          : null,
        location: {
          latitude,
          longitude,
          distance_meters: distanceMeters,
          allowed_radius_meters: allowedRadius,
          within_radius: withinRadius,
        },
        photo_url: photoUrl,
        message:
          withinRadius === false
            ? `Check-in saved, but location is outside allowed radius${
                detectedBranchName ? ` for ${detectedBranchName}` : ""
              }.`
            : detectedBranchName
            ? `Check-in saved successfully at ${detectedBranchName}.`
            : "Check-in saved successfully.",
      });
    }

    const checkoutAdminNote = buildAdminNote([
      existingLog.admin_note,
      withinRadius === false
        ? `SECURITY WARNING: Check-out outside allowed radius. Distance: ${
            distanceMeters ?? "not available"
          }m, allowed radius: ${allowedRadius ?? "not available"}m.`
        : null,
      existingLog.ip_address &&
      clientIp &&
      normalizeForCompare(existingLog.ip_address) !== normalizeForCompare(clientIp)
        ? `SECURITY NOTE: Check-out IP differs from check-in IP. Check-in IP: ${existingLog.ip_address}. Check-out IP: ${clientIp}.`
        : null,
      existingLog.device_info &&
      deviceInfo &&
      normalizeForCompare(existingLog.device_info) !== normalizeForCompare(deviceInfo)
        ? "SECURITY NOTE: Check-out device/browser differs from check-in device/browser."
        : null,
      existingLog.detected_branch_name &&
      detectedBranchName &&
      normalizeForCompare(existingLog.detected_branch_name) !==
        normalizeForCompare(detectedBranchName)
        ? `SECURITY NOTE: Check-out branch differs from check-in branch. Check-in branch: ${existingLog.detected_branch_name}. Check-out branch: ${detectedBranchName}.`
        : null,
    ]);

    const { data: attendance, error: updateError } = await supabaseAdmin
      .from("employee_attendance_logs")
      .update({
        check_out_at: now,
        check_out_latitude: latitude,
        check_out_longitude: longitude,
        check_out_distance_meters: distanceMeters,
        check_out_within_radius: withinRadius,
        check_out_photo_url: photoUrl,
        detected_branch_id: detectedBranchId,
        detected_branch_name: detectedBranchName,
        branch_distance_meters: distanceMeters,
        branch_within_radius: withinRadius,
        branch_name: logBranchName,
        admin_note: checkoutAdminNote,
        updated_at: now,
      })
      .eq("id", existingLog.id)
      .select("*")
      .single();

    if (updateError) {
      throw new Error(updateError.message || "Check-out failed.");
    }

    return jsonResponse({
      employee,
      attendance,
      action: "check_out",
      detected_branch: detectedBranch
        ? {
            id: detectedBranch.id,
            branch_name: detectedBranch.branch_name,
            branch_code: detectedBranch.branch_code,
          }
        : null,
      location: {
        latitude,
        longitude,
        distance_meters: distanceMeters,
        allowed_radius_meters: allowedRadius,
        within_radius: withinRadius,
      },
      photo_url: photoUrl,
      message:
        withinRadius === false
          ? `Check-out saved, but location is outside allowed radius${
              detectedBranchName ? ` for ${detectedBranchName}` : ""
            }.`
          : detectedBranchName
          ? `Check-out saved successfully at ${detectedBranchName}.`
          : "Check-out saved successfully.",
    });
  } catch (error: any) {
    return jsonResponse(
      {
        error: error?.message || "Attendance check failed.",
      },
      500
    );
  }
}
