import { NextRequest, NextResponse } from "next/server";
import { getAdminUserFromRequest } from "@/lib/adminAuth";
import { canManageUsers } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function cleanSearchValue(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[,%]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const search = cleanSearchValue(searchParams.get("search"));

    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) {
      throw new Error(error.message || "Failed to load users.");
    }

    const authUsers = Array.isArray(data?.users) ? data.users : [];
    const userIds = authUsers.map((user) => user.id).filter(Boolean);

    let profiles: any[] = [];

    if (userIds.length > 0) {
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, phone, city, role, is_active")
        .in("id", userIds);

      if (profileError) {
        throw new Error(profileError.message || "Failed to load user profiles.");
      }

      profiles = Array.isArray(profileData) ? profileData : [];
    }

    const profileMap = new Map<string, any>();

    profiles.forEach((profile) => {
      profileMap.set(profile.id, profile);
    });

    const users = authUsers
      .map((user) => {
        const profile = profileMap.get(user.id);

        return {
          id: user.id,
          email: String(user.email || "").trim().toLowerCase(),
          created_at: user.created_at || null,
          last_sign_in_at: user.last_sign_in_at || null,
          email_confirmed_at: user.email_confirmed_at || null,
          full_name: profile?.full_name || null,
          phone: profile?.phone || null,
          city: profile?.city || null,
          role: profile?.role || "customer",
          is_active: profile?.is_active !== false,
        };
      })
      .filter((user) => {
        if (!search) return true;

        const haystack = [
          user.email,
          user.full_name,
          user.phone,
          user.city,
          user.role,
        ]
          .map((value) => String(value || "").toLowerCase())
          .join(" ");

        return haystack.includes(search);
      })
      .sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });

    return jsonResponse({
      admin: admin.user,
      users,
      summary: {
        total: users.length,
        active: users.filter((user) => user.is_active).length,
        inactive: users.filter((user) => !user.is_active).length,
      },
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "Failed to load users." },
      500
    );
  }
}