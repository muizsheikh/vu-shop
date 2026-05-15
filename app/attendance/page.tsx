"use client";

import { ChangeEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  Camera,
  CheckCircle2,
  Clock3,
  ImagePlus,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
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

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function loadStatus(tokenFromCheck?: string) {
    setLoadingStatus(true);
    setErrorText("");

    try {
      const token = tokenFromCheck || (await getAccessToken());

      if (!token) {
        router.replace("/account/login?next=/attendance");
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
      const token = await getAccessToken();

      if (!token) {
        router.replace("/account/login?next=/attendance");
        return;
      }

      if (!employee?.id) {
        throw new Error("Employee profile not found.");
      }

      if (!photoFile) {
        throw new Error(`Please capture or select a photo before ${getActionLabel(action)}.`);
      }

      const position = await getBrowserLocation();

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

      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session?.access_token) {
        router.replace("/account/login?next=/attendance");
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

  if (authLoading) {
    return (
      <div className="mx-auto max-w-md p-5">
        <div className="rounded-[28px] border border-neutral-200 bg-white p-6 text-center shadow-sm">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#a30105]" />
          <p className="mt-3 text-sm font-bold text-neutral-700">
            Checking login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8] px-4 py-6">
      <div className="mx-auto max-w-md space-y-5">
        <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#a30105] text-white">
              <ShieldCheck className="h-6 w-6" />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#a30105]">
                Vape Ustad
              </p>
              <h1 className="text-2xl font-black text-neutral-950">
                Attendance
              </h1>
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-neutral-500">
            Geo-location + photo based employee check-in/check-out system.
            Please allow location and camera/photo permission when asked.
          </p>
        </div>

        {loadingStatus ? (
          <div className="rounded-[28px] border border-neutral-200 bg-white p-8 text-center shadow-sm">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#a30105]" />
            <p className="mt-3 text-sm font-bold text-neutral-600">
              Loading attendance status...
            </p>
          </div>
        ) : employee ? (
          <>
            <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
              <div className="flex items-start gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff7f7] text-[#a30105]">
                  <UserRound className="h-6 w-6" />
                </div>

                <div className="min-w-0">
                  <h2 className="text-xl font-black text-neutral-950">
                    {employee.employee_name}
                  </h2>
                  <p className="mt-1 text-sm font-bold text-neutral-500">
                    {employee.designation || "Employee"}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-sm font-bold text-neutral-500">
                    <MapPin className="h-4 w-4 text-[#a30105]" />
                    {employee.branch_name}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-500">
                Today Status
              </p>

              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-neutral-600">
                      Check In
                    </span>
                    <span className="text-sm font-black text-neutral-950">
                      {formatDate(attendance?.check_in_at)}
                    </span>
                  </div>

                  {attendance?.check_in_distance_meters !== null &&
                  attendance?.check_in_distance_meters !== undefined ? (
                    <p className="mt-2 text-xs font-bold text-neutral-500">
                      Distance: {attendance.check_in_distance_meters}m
                    </p>
                  ) : null}

                  {attendance?.check_in_photo_url ? (
                    <a
                      href={attendance.check_in_photo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-xs font-black uppercase text-[#a30105]"
                    >
                      View Check-in Photo
                    </a>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-neutral-600">
                      Check Out
                    </span>
                    <span className="text-sm font-black text-neutral-950">
                      {formatDate(attendance?.check_out_at)}
                    </span>
                  </div>

                  {attendance?.check_out_distance_meters !== null &&
                  attendance?.check_out_distance_meters !== undefined ? (
                    <p className="mt-2 text-xs font-bold text-neutral-500">
                      Distance: {attendance.check_out_distance_meters}m
                    </p>
                  ) : null}

                  {attendance?.check_out_photo_url ? (
                    <a
                      href={attendance.check_out_photo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-xs font-black uppercase text-[#a30105]"
                    >
                      View Check-out Photo
                    </a>
                  ) : null}
                </div>
              </div>

              {nextAction !== "completed" ? (
                <div className="mt-5 rounded-2xl border border-[#a30105]/20 bg-[#fff7f7] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#a30105]">
                      <Camera className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-neutral-950">
                        {getActionLabel(nextAction)} Photo Required
                      </p>
                      <p className="mt-1 text-xs font-bold leading-5 text-neutral-500">
                        Camera se selfie/photo capture karein ya gallery se clear photo select karein.
                      </p>

                      <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#a30105]/20 bg-white px-4 py-3 text-sm font-black text-[#a30105] transition hover:bg-[#fff1f1]">
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
                        <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                          <img
                            src={photoPreviewUrl}
                            alt="Attendance photo preview"
                            className="max-h-72 w-full object-cover"
                          />

                          <button
                            type="button"
                            onClick={clearSelectedPhoto}
                            className="w-full border-t border-neutral-200 bg-white px-4 py-3 text-xs font-black uppercase text-red-700"
                          >
                            Remove Photo
                          </button>
                        </div>
                      ) : currentPhotoUrl ? (
                        <a
                          href={currentPhotoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex text-xs font-black uppercase text-[#a30105]"
                        >
                          View saved photo
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-5">
                {nextAction === "completed" ? (
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center text-green-700">
                    <CheckCircle2 className="mx-auto h-8 w-8" />
                    <p className="mt-3 text-sm font-black uppercase">
                      Attendance Completed
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={saving || uploadingPhoto}
                    onClick={() => submitAttendance(nextAction)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#a30105] px-5 py-4 text-sm font-black uppercase text-white transition hover:bg-[#8f0104] disabled:cursor-not-allowed disabled:opacity-60"
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
                )}
              </div>
            </div>
          </>
        ) : null}

        {successText ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700">
            {successText}
          </div>
        ) : null}

        {errorText ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            <div className="flex gap-2">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorText}</span>
            </div>
          </div>
        ) : null}

        <Link
          href="/account"
          className="block rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-center text-sm font-black text-neutral-900 shadow-sm transition hover:bg-neutral-50"
        >
          Back to Account
        </Link>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex gap-2 text-sm font-bold leading-6 text-blue-700">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Location accuracy depends on mobile GPS/browser permission. Photo
              is uploaded to secure Vape Ustad attendance storage.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
