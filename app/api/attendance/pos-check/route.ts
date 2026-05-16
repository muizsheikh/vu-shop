import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ATTENDANCE_PHOTOS_BUCKET = "attendance-photos";

type BridgePayload = {
  iss?: string;
  aud?: string;
  type?: string;
  erp_user?: string;
  email?: string;
  full_name?: string;
  iat?: number;
  exp?: number;
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

function base64UrlDecode(value: string) {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function base64UrlEncode(buffer: Buffer) {
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function verifyBridgeToken(token: string): BridgePayload {
  const secret = String(process.env.POS_ATTENDANCE_BRIDGE_SECRET || "").trim();

  if (!secret) {
    throw new Error("POS attendance bridge secret is not configured.");
  }

  const cleanToken = String(token || "").trim();
  const parts = cleanToken.split(".");

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Invalid POS attendance token.");
  }

  const body = parts[0];
  const signature = parts[1];

  const expected = base64UrlEncode(
    crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest()
  );

  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid POS attendance token signature.");
  }

  const payload = JSON.parse(base64UrlDecode(body).toString("utf8")) as BridgePayload;
  const now = Math.floor(Date.now() / 1000);

  if (payload.type !== "pos_attendance") {
    throw new Error("Invalid POS attendance token type.");
  }

  if (payload.aud !== "vapeustad.com") {
    throw new Error("Invalid POS attendance token audience.");
  }

  if (!payload.email || !String(payload.email).includes("@")) {
    throw new Error("POS attendance token email is missing.");
  }

  if (!payload.exp || Number(payload.exp) < now) {
    throw new Error("POS attendance token has expired. Please reopen attendance from POS.");
  }

  return {
    ...payload,
    email: String(payload.email).trim().toLowerCase(),
  };
}

function cleanNumber(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number)) return null;

  return number;
}

function cleanAction(value: unknown): "check_in" | "check_out" | null {
  const action = String(value || "").trim().toLowerCase();

  if (action === "check_in" || action === "check_out") {
    return action as "check_in" | "check_out";
  }

  return null;
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

async function getEmployeeByBridgeEmail(email: string) {
  const { data: employee, error } = await supabaseAdmin
    .from("admin_employees")
    .select(
      "id, user_id, erp_employee_id, employee_name, employee_email, employee_phone, branch_name, designation, allowed_latitude, allowed_longitude, allowed_radius_meters, is_active, notes, created_at, updated_at"
    )
    .eq("employee_email", email)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load employee.");
  }

  if (!employee) {
    throw new Error(
      `No active employee profile is linked with POS email: ${email}. Please contact admin.`
    );
  }

  return employee;
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

async function getTodayAttendance(employeeId: string) {
  const today = getTodayDate();

  const { data: attendance, error } = await supabaseAdmin
    .from("employee_attendance_logs")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("attendance_date", today)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load attendance status.");
  }

  return {
    today,
    attendance,
  };
}

function buildStatus(today: string, attendance: any) {
  return {
    date: today,
    has_checked_in: Boolean(attendance?.check_in_at),
    has_checked_out: Boolean(attendance?.check_out_at),
    next_action: !attendance?.check_in_at
      ? "check_in"
      : attendance?.check_out_at
      ? "completed"
      : "check_out",
  };
}

function getFileExtension(file: File) {
  const nameExtension = file.name.split(".").pop()?.toLowerCase();

  if (nameExtension && /^[a-z0-9]+$/.test(nameExtension)) {
    return nameExtension;
  }

  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/heic") return "heic";

  return "jpg";
}

async function uploadAttendancePhotoFromServer(args: {
  file: File;
  employeeId: string;
  action: "check_in" | "check_out";
}) {
  const extension = getFileExtension(args.file);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeEmployeeId = args.employeeId.replace(/[^a-zA-Z0-9_-]/g, "");
  const randomPart = crypto.randomUUID();

  const path = `${safeEmployeeId}/${args.action}/${timestamp}-${randomPart}.${extension}`;
  const arrayBuffer = await args.file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await supabaseAdmin.storage
    .from(ATTENDANCE_PHOTOS_BUCKET)
    .upload(path, buffer, {
      cacheControl: "3600",
      contentType: args.file.type || "image/jpeg",
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || "Photo upload failed.");
  }

  const { data } = supabaseAdmin.storage
    .from(ATTENDANCE_PHOTOS_BUCKET)
    .getPublicUrl(path);

  if (!data?.publicUrl) {
    throw new Error("Photo uploaded but public URL was not generated.");
  }

  return data.publicUrl;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("bridge_token") || "";
    const payload = verifyBridgeToken(token);
    const email = String(payload.email || "").trim().toLowerCase();

    const employee = await getEmployeeByBridgeEmail(email);
    const { today, attendance } = await getTodayAttendance(employee.id);

    return jsonResponse({
      bridge: {
        ok: true,
        email,
        erp_user: payload.erp_user || null,
        full_name: payload.full_name || null,
      },
      employee,
      attendance,
      status: buildStatus(today, attendance),
    });
  } catch (error: any) {
    return jsonResponse(
      {
        error: error?.message || "Failed to load POS attendance status.",
      },
      401
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const token = String(form.get("bridge_token") || "").trim();
    const payload = verifyBridgeToken(token);
    const email = String(payload.email || "").trim().toLowerCase();

    const action = cleanAction(form.get("action"));
    const latitude = cleanNumber(form.get("latitude"));
    const longitude = cleanNumber(form.get("longitude"));
    const photo = form.get("photo");

    if (!action) {
      return jsonResponse({ error: "Invalid attendance action." }, 400);
    }

    if (latitude === null || longitude === null) {
      return jsonResponse(
        { error: "Latitude and longitude are required for attendance." },
        400
      );
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return jsonResponse({ error: "Invalid geo location values." }, 400);
    }

    if (!(photo instanceof File) || !photo.type.startsWith("image/")) {
      return jsonResponse(
        { error: "A valid photo is required for attendance." },
        400
      );
    }

    const maxBytes = 8 * 1024 * 1024;
    if (photo.size > maxBytes) {
      return jsonResponse(
        { error: "Photo size must be under 8MB." },
        400
      );
    }

    const employee = await getEmployeeByBridgeEmail(email);
    const { today, attendance: existingLog } = await getTodayAttendance(employee.id);

    if (action === "check_in" && existingLog?.check_in_at) {
      return jsonResponse(
        {
          error: "You have already checked in today.",
          attendance: existingLog,
          employee,
          status: buildStatus(today, existingLog),
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
          status: buildStatus(today, existingLog),
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
          status: buildStatus(today, existingLog),
        },
        400
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

    const now = new Date().toISOString();
    const clientIp = getClientIp(req);
    const deviceInfo = getDeviceInfo(req);

    const photoUrl = await uploadAttendancePhotoFromServer({
      file: photo,
      employeeId: employee.id,
      action,
    });

    if (action === "check_in") {
      const adminNote = buildAdminNote([
        `POS ATTENDANCE BRIDGE: ERP user ${payload.erp_user || email}.`,
        withinRadius === false
          ? `SECURITY WARNING: Check-in outside allowed radius. Distance: ${
              distanceMeters ?? "not available"
            }m, allowed radius: ${allowedRadius ?? "not available"}m.`
          : null,
        !detectedBranchName
          ? "SECURITY NOTE: No active branch location detected. Employee fallback location was used if available."
          : null,
      ]);

      const payloadToInsert = {
        employee_id: employee.id,
        user_id: employee.user_id || null,
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

      const { data: attendance, error } = await supabaseAdmin
        .from("employee_attendance_logs")
        .insert(payloadToInsert)
        .select("*")
        .single();

      if (error) {
        const message = String(error.message || "");

        if (message.toLowerCase().includes("duplicate")) {
          return jsonResponse(
            { error: "You have already checked in today.", employee },
            400
          );
        }

        throw new Error(error.message || "Check-in failed.");
      }

      return jsonResponse({
        bridge: { ok: true, email },
        employee,
        attendance,
        status: buildStatus(today, attendance),
        action: "check_in",
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
      `POS ATTENDANCE BRIDGE: ERP user ${payload.erp_user || email}.`,
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

    const { data: attendance, error } = await supabaseAdmin
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

    if (error) {
      throw new Error(error.message || "Check-out failed.");
    }

    return jsonResponse({
      bridge: { ok: true, email },
      employee,
      attendance,
      status: buildStatus(today, attendance),
      action: "check_out",
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
        error: error?.message || "POS attendance check failed.",
      },
      500
    );
  }
}
