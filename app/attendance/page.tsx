"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock3,
  ImagePlus,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const ATTENDANCE_PHOTOS_BUCKET = "attendance-photos";

type Employee = {
  id: string;
  employee_name: string;
  branch_name: string;
  designation: string | null;
  allowed_radius_meters: number | null;
};

type Attendance = {
  id: string;
  attendance_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_distance_meters: number | null;
  check_out_distance_meters: number | null;
  check_in_within_radius: boolean | null;
  check_out_within_radius: boolean | null;
  check_in_photo_url?: string | null;
  check_out_photo_url?: string | null;
};

type StatusState = {
  date: string;
  has_checked_in: boolean;
  has_checked_out: boolean;
  next_action: "check_in" | "check_out" | "completed";
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";

  try {
    return new Date(value).toLocaleString("en-PK", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function formatOnlyDate(value: string | null | undefined) {
  if (!value) return "Today";

  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString("en-PK", {
      dateStyle: "medium",
    });
  } catch {
    return value;
  }
}

function formatDistance(value: number | null | undefined) {
  if (value === null || value === undefined) return "Not checked";
  return `${value}m`;
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

function getActionLabel(action: "check_in" | "check_out") {
  return action === "check_in" ? "Check In" : "Check Out";
}

function getStatusCopy(status: StatusState | null) {
  if (!status?.has_checked_in) {
    return {
      label: "Not Checked In",
      detail: "Start your day by capturing a photo and sharing your current location.",
      className: "border-amber-200 bg-amber-50 text-amber-800",
      iconClassName: "bg-amber-100 text-amber-700",
    };
  }

  if (status.has_checked_in && !status.has_checked_out) {
    return {
      label: "Checked In",
      detail: "Your check-in is recorded. Complete check-out before leaving.",
      className: "border-blue-200 bg-blue-50 text-blue-800",
      iconClassName: "bg-blue-100 text-blue-700",
    };
  }

  return {
    label: "Completed",
    detail: "Your attendance for today is complete.",
    className: "border-green-200 bg-green-50 text-green-800",
    iconClassName: "bg-green-100 text-green-700",
  };
}

function getRadiusBadge(value: boolean | null | undefined) {
  if (value === true) {
    return {
      label: "Inside Radius",
      className: "border-green-200 bg-green-50 text-green-700",
    };
  }

  if (value === false) {
    return {
      label: "Outside Radius",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  return {
    label: "Not Checked",
    className: "border-neutral-200 bg-white text-neutral-600",
  };
}

function getBridgeTokenFromUrl() {
  if (typeof window === "undefined") return "";

  try {
    return new URLSearchParams(window.location.search).get("bridge_token") || "";
  } catch {
    return "";
  }
}

function isPosSource() {
  if (typeof window === "undefined") return false;

  try {
    return new URLSearchParams(window.location.search).get("source") === "pos";
  } catch {
    return false;
  }
}

function isAttendanceHost() {
  if (typeof window === "undefined") return false;

  return window.location.hostname === "attendance.vapeustad.com";
}

function getCurrentAttendancePath() {
  if (typeof window === "undefined") return "/attendance";

  const search = window.location.search || "";

  if (isAttendanceHost()) {
    return `/${search}`;
  }

  const pathname = window.location.pathname || "/attendance";

  if (pathname.startsWith("/staff-attendance")) {
    return `/staff-attendance${search}`;
  }

  return `/attendance${search}`;
}

function getStaffAppMode() {
  if (typeof window === "undefined") return false;

  return (
    isAttendanceHost() ||
    window.location.pathname.startsWith("/staff-attendance")
  );
}

export default function AttendancePage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [status, setStatus] = useState<StatusState | null>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");

  const [successText, setSuccessText] = useState("");
  const [errorText, setErrorText] = useState("");
  const [bridgeToken, setBridgeToken] = useState("");
  const [posMode, setPosMode] = useState(false);
  const [staffAppMode, setStaffAppMode] = useState(false);

  const isBridgeMode = Boolean(bridgeToken);
  const isDedicatedMode = posMode || staffAppMode;

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function loadStatus(tokenFromCheck?: string, bridgeTokenFromCheck?: string) {
    setLoadingStatus(true);
    setErrorText("");

    try {
      const activeBridgeToken = bridgeTokenFromCheck || bridgeToken;

      if (activeBridgeToken) {
        const res = await fetch(
          `/api/attendance/pos-check?bridge_token=${encodeURIComponent(activeBridgeToken)}`,
          {
            cache: "no-store",
          }
        );

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(json?.error || "Failed to load POS attendance status.");
        }

        setEmployee(json?.employee || null);
        setAttendance(json?.attendance || null);
        setStatus(json?.status || null);
        return;
      }

      const token = tokenFromCheck || (await getAccessToken());

      if (!token) {
        router.replace(`/account/login?next=${encodeURIComponent(getCurrentAttendancePath())}`);
        return;
      }

      const res = await fetch("/api/attendance/check", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load attendance status.");
      }

      setEmployee(json?.employee || null);
      setAttendance(json?.attendance || null);
      setStatus(json?.status || null);
    } catch (error: any) {
      setErrorText(error?.message || "Failed to load attendance status.");
      setEmployee(null);
      setAttendance(null);
      setStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }

  function getBrowserLocation(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geo location is not supported on this device."));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      });
    });
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;

    setErrorText("");
    setSuccessText("");

    if (!file) {
      setPhotoFile(null);
      setPhotoPreviewUrl("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setPhotoFile(null);
      setPhotoPreviewUrl("");
      setErrorText("Please select a valid image/photo.");
      return;
    }

    const maxSizeMb = 8;
    const maxBytes = maxSizeMb * 1024 * 1024;

    if (file.size > maxBytes) {
      setPhotoFile(null);
      setPhotoPreviewUrl("");
      setErrorText(`Photo size must be under ${maxSizeMb}MB.`);
      return;
    }

    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }

    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  }

  function clearSelectedPhoto() {
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }

    setPhotoFile(null);
    setPhotoPreviewUrl("");
  }

  async function uploadAttendancePhoto(
    action: "check_in" | "check_out",
    file: File,
    employeeId: string
  ) {
    const extension = getFileExtension(file);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeEmployeeId = employeeId.replace(/[^a-zA-Z0-9_-]/g, "");
    const randomPart =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    const path = `${safeEmployeeId}/${action}/${timestamp}-${randomPart}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(ATTENDANCE_PHOTOS_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message || "Photo upload failed.");
    }

    const { data } = supabase.storage
      .from(ATTENDANCE_PHOTOS_BUCKET)
      .getPublicUrl(path);

    if (!data?.publicUrl) {
      throw new Error("Photo uploaded but public URL was not generated.");
    }

    return data.publicUrl;
  }

  async function submitAttendance(action: "check_in" | "check_out") {
    setSaving(true);
    setErrorText("");
    setSuccessText("");

    try {
      if (!employee?.id) {
        throw new Error("Employee profile not found.");
      }

      if (!photoFile) {
        throw new Error(`Please capture or select a photo before ${getActionLabel(action)}.`);
      }

      const position = await getBrowserLocation();

      if (bridgeToken) {
        setUploadingPhoto(true);

        const form = new FormData();
        form.set("bridge_token", bridgeToken);
        form.set("action", action);
        form.set("latitude", String(position.coords.latitude));
        form.set("longitude", String(position.coords.longitude));
        form.set("photo", photoFile);

        const res = await fetch("/api/attendance/pos-check", {
          method: "POST",
          body: form,
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(json?.error || "POS attendance save failed.");
        }

        clearSelectedPhoto();
        setSuccessText(json?.message || "Attendance saved successfully.");
        setEmployee(json?.employee || null);
        setAttendance(json?.attendance || null);
        setStatus(json?.status || null);

        await loadStatus(undefined, bridgeToken);
        return;
      }

      const token = await getAccessToken();

      if (!token) {
        router.replace(`/account/login?next=${encodeURIComponent(getCurrentAttendancePath())}`);
        return;
      }

      setUploadingPhoto(true);
      const photoUrl = await uploadAttendancePhoto(action, photoFile, employee.id);
      setUploadingPhoto(false);

      const res = await fetch("/api/attendance/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          photo_url: photoUrl,
          check_in_photo_url: action === "check_in" ? photoUrl : undefined,
          check_out_photo_url: action === "check_out" ? photoUrl : undefined,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Attendance save failed.");
      }

      clearSelectedPhoto();
      setSuccessText(json?.message || "Attendance saved successfully.");
      setEmployee(json?.employee || null);
      setAttendance(json?.attendance || null);

      await loadStatus(token);
    } catch (error: any) {
      setErrorText(
        error?.message ||
          "Location permission denied, photo upload failed, or attendance save failed."
      );
    } finally {
      setUploadingPhoto(false);
      setSaving(false);
    }
  }

  useEffect(() => {
    async function init() {
      setAuthLoading(true);

      const nextBridgeToken = getBridgeTokenFromUrl();
      const nextPosMode = isPosSource();
      const nextStaffAppMode = getStaffAppMode();

      setBridgeToken(nextBridgeToken);
      setPosMode(nextPosMode);
      setStaffAppMode(nextStaffAppMode);

      if (nextBridgeToken) {
        setAuthLoading(false);
        await loadStatus(undefined, nextBridgeToken);
        return;
      }

      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session?.access_token) {
        router.replace(`/account/login?next=${encodeURIComponent(getCurrentAttendancePath())}`);
        return;
      }

      setAuthLoading(false);
      await loadStatus(session.access_token);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  const nextAction = status?.next_action || "check_in";
  const currentPhotoUrl =
    nextAction === "check_out"
      ? attendance?.check_out_photo_url
      : attendance?.check_in_photo_url;

  const statusCopy = useMemo(() => getStatusCopy(status), [status]);
  const checkInRadius = getRadiusBadge(attendance?.check_in_within_radius);
  const checkOutRadius = getRadiusBadge(attendance?.check_out_within_radius);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f7f7f8] px-4 py-10">
        <div className="mx-auto max-w-md rounded-[28px] border border-neutral-200 bg-white p-6 text-center shadow-sm">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#a30105]" />
          <p className="mt-3 text-sm font-bold text-neutral-700">
            Checking login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-[#f7f7f8] px-4 ${isDedicatedMode ? "py-3" : "py-6"}`}>
      <div className={`mx-auto space-y-5 ${isDedicatedMode ? "max-w-4xl" : "max-w-5xl"}`}>
        <div className="overflow-hidden rounded-[32px] border border-neutral-200 bg-white shadow-[0_20px_70px_rgba(0,0,0,0.07)]">
          <div className="border-b border-neutral-200 bg-gradient-to-br from-white via-white to-[#fff7f7] p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-[#a30105] text-white shadow-sm">
                  <ShieldCheck className="h-6 w-6" />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-[#a30105]">
                    {isBridgeMode ? "POS Staff Attendance" : staffAppMode ? "Vape Ustad Attendance App" : "Staff Attendance"}
                  </p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight text-neutral-950">
                    Check-in / Check-out
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-neutral-500">
                    Secure attendance with GPS location and photo verification. Please allow location and camera/photo permissions when prompted.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {!isDedicatedMode ? (
                  <Link
                    href="/account"
                    className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-black text-neutral-900 transition hover:bg-neutral-50"
                  >
                    Account
                  </Link>
                ) : null}

                <button
                  type="button"
                  onClick={() => loadStatus()}
                  disabled={loadingStatus}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-black text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingStatus ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {loadingStatus ? (
            <div className="p-10 text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#a30105]" />
              <p className="mt-3 text-sm font-bold text-neutral-600">
                Loading attendance status...
              </p>
            </div>
          ) : employee ? (
            <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="border-b border-neutral-200 p-5 sm:p-6 lg:border-b-0 lg:border-r">
                <div className="rounded-[28px] border border-neutral-200 bg-neutral-50 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-[#a30105] shadow-sm">
                      <UserRound className="h-6 w-6" />
                    </div>

                    <div className="min-w-0">
                      <h2 className="text-xl font-black text-neutral-950">
                        {employee.employee_name}
                      </h2>
                      <p className="mt-1 text-sm font-bold text-neutral-500">
                        {employee.designation || "Staff Member"}
                      </p>
                      <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-[#a30105]/20 bg-white px-3 py-1 text-xs font-black uppercase text-[#a30105]">
                        <MapPin className="h-3.5 w-3.5" />
                        {employee.branch_name || "Branch not assigned"}
                      </p>
                    </div>
                  </div>

                  <div className={`mt-5 rounded-2xl border p-4 ${statusCopy.className}`}>
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${statusCopy.iconClassName}`}>
                        {status?.next_action === "completed" ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : status?.has_checked_in ? (
                          <Clock3 className="h-5 w-5" />
                        ) : (
                          <AlertTriangle className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <div className="text-lg font-black">{statusCopy.label}</div>
                        <div className="mt-1 text-xs font-bold opacity-80">
                          {formatOnlyDate(status?.date)}
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-bold leading-6 opacity-80">
                      {statusCopy.detail}
                    </p>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-500">
                          Check In
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${checkInRadius.className}`}>
                          {checkInRadius.label}
                        </span>
                      </div>
                      <div className="mt-3 text-sm font-black leading-6 text-neutral-950">
                        {formatDate(attendance?.check_in_at)}
                      </div>
                      <div className="mt-2 text-xs font-bold text-neutral-500">
                        Distance: {formatDistance(attendance?.check_in_distance_meters)}
                      </div>
                      {attendance?.check_in_photo_url ? (
                        <a
                          href={attendance.check_in_photo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex text-xs font-black uppercase text-[#a30105]"
                        >
                          View Photo
                        </a>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-500">
                          Check Out
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${checkOutRadius.className}`}>
                          {checkOutRadius.label}
                        </span>
                      </div>
                      <div className="mt-3 text-sm font-black leading-6 text-neutral-950">
                        {formatDate(attendance?.check_out_at)}
                      </div>
                      <div className="mt-2 text-xs font-bold text-neutral-500">
                        Distance: {formatDistance(attendance?.check_out_distance_meters)}
                      </div>
                      {attendance?.check_out_photo_url ? (
                        <a
                          href={attendance.check_out_photo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex text-xs font-black uppercase text-[#a30105]"
                        >
                          View Photo
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                {nextAction !== "completed" ? (
                  <div className="rounded-[28px] border border-[#a30105]/20 bg-[#fff7f7] p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#a30105] shadow-sm">
                        <Camera className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#a30105]">
                          Photo Verification
                        </p>
                        <h2 className="mt-2 text-2xl font-black text-neutral-950">
                          {getActionLabel(nextAction)} Photo Required
                        </h2>
                        <p className="mt-2 text-sm font-bold leading-6 text-neutral-600">
                          Capture a fresh selfie/photo or select a clear image. GPS location will be requested when you submit attendance.
                        </p>

                        <label className="mt-5 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#a30105]/20 bg-white px-4 py-4 text-sm font-black text-[#a30105] transition hover:bg-[#fff1f1]">
                          <ImagePlus className="h-4 w-4" />
                          Capture / Select Photo
                          <input
                            type="file"
                            accept="image/*"
                            capture="user"
                            onChange={handlePhotoChange}
                            className="hidden"
                          />
                        </label>

                        {photoPreviewUrl ? (
                          <div className="mt-5 overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-sm">
                            <img
                              src={photoPreviewUrl}
                              alt="Attendance photo preview"
                              className="max-h-[360px] w-full object-cover"
                            />

                            <button
                              type="button"
                              onClick={clearSelectedPhoto}
                              className="w-full border-t border-neutral-200 bg-white px-4 py-3 text-xs font-black uppercase text-red-700 transition hover:bg-red-50"
                            >
                              Remove Photo
                            </button>
                          </div>
                        ) : currentPhotoUrl ? (
                          <a
                            href={currentPhotoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-4 inline-flex text-xs font-black uppercase text-[#a30105]"
                          >
                            View saved photo
                          </a>
                        ) : null}

                        <button
                          type="button"
                          disabled={saving || uploadingPhoto}
                          onClick={() => submitAttendance(nextAction)}
                          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#a30105] px-5 py-4 text-sm font-black uppercase text-white shadow-[0_14px_35px_rgba(163,1,5,0.18)] transition hover:bg-[#8f0104] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {saving || uploadingPhoto ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin" />
                              {uploadingPhoto ? "Uploading Photo..." : "Saving..."}
                            </>
                          ) : nextAction === "check_in" ? (
                            <>
                              <LogIn className="h-5 w-5" />
                              Check In Now
                            </>
                          ) : (
                            <>
                              <LogOut className="h-5 w-5" />
                              Check Out Now
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[28px] border border-green-200 bg-green-50 p-8 text-center text-green-700">
                    <CheckCircle2 className="mx-auto h-12 w-12" />
                    <h2 className="mt-4 text-2xl font-black text-green-800">
                      Attendance Completed
                    </h2>
                    <p className="mx-auto mt-2 max-w-md text-sm font-bold leading-6 text-green-700">
                      Your check-in and check-out records have been saved for today.
                    </p>

                    {isDedicatedMode ? (
                      <div className="mt-5 rounded-2xl border border-green-200 bg-white px-5 py-4 text-sm font-black leading-6 text-green-800">
                        Attendance completed.<br />
                        You may now close the app.
                      </div>
                    ) : null}
                  </div>
                )}

                {!isDedicatedMode ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <Link
                      href="/account"
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-sm font-black text-neutral-900 transition hover:bg-neutral-50"
                    >
                      Back to Account
                    </Link>
                    <Link
                      href="/account"
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#a30105]/20 bg-[#fff7f7] px-5 py-4 text-sm font-black text-[#a30105] transition hover:bg-[#fff1f1]"
                    >
                      Staff Dashboard
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {successText ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700 shadow-sm">
            <div className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{successText}</span>
            </div>
          </div>
        ) : null}

        {errorText ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 shadow-sm">
            <div className="flex gap-2">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorText}</span>
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex gap-2 text-sm font-bold leading-6 text-blue-700">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Location accuracy depends on mobile GPS and browser permission. Attendance photos are stored in Vape Ustad attendance storage for verification.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
