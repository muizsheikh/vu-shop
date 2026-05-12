import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAllowedAdminRole, normalizeRole } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const authClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export type AdminAuthResult =
  | {
      ok: true;
      user: {
        id: string;
        email: string;
        role: string;
        is_active: boolean;
      };
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

export async function getAdminUserFromRequest(
  req: NextRequest
): Promise<AdminAuthResult> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return {
      ok: false,
      status: 401,
      message: "Missing authorization token.",
    };
  }

  const { data, error } = await authClient.auth.getUser(token);

  if (error || !data.user) {
    return {
      ok: false,
      status: 401,
      message: "Invalid or expired session.",
    };
  }

  const userId = data.user.id;
  const email = String(data.user.email || "").trim().toLowerCase();

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return {
      ok: false,
      status: 403,
      message: "Admin profile not found.",
    };
  }

  const role = normalizeRole(profile.role);
  const isActive = Boolean(profile.is_active);

  if (!isActive) {
    return {
      ok: false,
      status: 403,
      message: "This account is disabled.",
    };
  }

  if (!isAllowedAdminRole(role)) {
    return {
      ok: false,
      status: 403,
      message: "You are not allowed to access admin area.",
    };
  }

  return {
    ok: true,
    user: {
      id: userId,
      email,
      role,
      is_active: isActive,
    },
  };
}