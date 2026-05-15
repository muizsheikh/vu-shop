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
};

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function cleanNumber(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number)) return null;

  return number;
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getClientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    ""
  );
}

function getDeviceInfo(req: NextRequest) {
  return req.headers.get("user-agent") || "";
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
    const requestedAction = body.action || "auto";

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

    const allowedLatitude = cleanNumber(employee.allowed_latitude);
    const allowedLongitude = cleanNumber(employee.allowed_longitude);
    const allowedRadius = Number(employee.allowed_radius_meters || 150);

    let distanceMeters: number | null = null;
    let withinRadius: boolean | null = null;

    if (allowedLatitude !== null && allowedLongitude !== null) {
      distanceMeters = calculateDistanceMeters(
        allowedLatitude,
        allowedLongitude,
        latitude,
        longitude
      );

      withinRadius = distanceMeters <= allowedRadius;
    }

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
    } else {
      action = !existingLog?.check_in_at ? "check_in" : "check_out";
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
      const payload = {
        employee_id: employee.id,
        user_id: userId,
        attendance_date: today,
        check_in_at: now,
        check_in_latitude: latitude,
        check_in_longitude: longitude,
        check_in_distance_meters: distanceMeters,
        check_in_within_radius: withinRadius,
        status: "present",
        branch_name: employee.branch_name,
        device_info: getDeviceInfo(req),
        ip_address: getClientIp(req),
        erp_sync_status: "pending",
        updated_at: now,
      };

      const { data: attendance, error: insertError } = await supabaseAdmin
        .from("employee_attendance_logs")
        .insert(payload)
        .select("*")
        .single();

      if (insertError) {
        throw new Error(insertError.message || "Check-in failed.");
      }

      return jsonResponse({
        employee,
        attendance,
        action: "check_in",
        location: {
          latitude,
          longitude,
          distance_meters: distanceMeters,
          allowed_radius_meters: allowedRadius,
          within_radius: withinRadius,
        },
        message:
          withinRadius === false
            ? "Check-in saved, but location is outside allowed radius."
            : "Check-in saved successfully.",
      });
    }

    const { data: attendance, error: updateError } = await supabaseAdmin
      .from("employee_attendance_logs")
      .update({
        check_out_at: now,
        check_out_latitude: latitude,
        check_out_longitude: longitude,
        check_out_distance_meters: distanceMeters,
        check_out_within_radius: withinRadius,
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
      location: {
        latitude,
        longitude,
        distance_meters: distanceMeters,
        allowed_radius_meters: allowedRadius,
        within_radius: withinRadius,
      },
      message:
        withinRadius === false
          ? "Check-out saved, but location is outside allowed radius."
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