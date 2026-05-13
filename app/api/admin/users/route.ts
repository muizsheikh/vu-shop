import { NextRequest, NextResponse } from "next/server";
import { getAdminUserFromRequest } from "@/lib/adminAuth";
import { canManageUsers, canViewUsers, normalizeRole } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  address_line1: string | null;
  role: string | null;
  is_active: boolean | null;
  updated_at: string | null;
};

function normalizeSearch(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function userMatchesSearch(
  user: any,
  profile: ProfileRow | undefined,
  search: string
) {
  if (!search) return true;

  const haystack = [
    user?.id,
    user?.email,
    profile?.full_name,
    profile?.phone,
    profile?.city,
    profile?.address_line1,
    profile?.role,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");

  return haystack.includes(search);
}

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminUserFromRequest(req);

    if (!admin.ok) {
      return NextResponse.json(
        {
          error: admin.message,
        },
        { status: admin.status }
      );
    }

    const adminRole = admin.user.role;
    const userCanViewUsers = canViewUsers(adminRole);
    const userCanManageUsers = canManageUsers(adminRole);

    if (!userCanViewUsers) {
      return NextResponse.json(
        {
          error: "You do not have permission to view users.",
        },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const search = normalizeSearch(url.searchParams.get("search"));
    const roleFilter = normalizeRole(url.searchParams.get("role") || "all");
    const activeFilter = String(url.searchParams.get("active") || "all")
      .trim()
      .toLowerCase();

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (authError) {
      throw new Error(authError.message || "Failed to load auth users.");
    }

    const authUsers = Array.isArray(authData?.users) ? authData.users : [];
    const userIds = authUsers.map((user) => user.id).filter(Boolean);

    let profiles: ProfileRow[] = [];

    if (userIds.length > 0) {
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select(
          "id, full_name, phone, city, address_line1, role, is_active, updated_at"
        )
        .in("id", userIds);

      if (profileError) {
        throw new Error(profileError.message || "Failed to load profiles.");
      }

      profiles = Array.isArray(profileData) ? profileData : [];
    }

    const profileMap = new Map<string, ProfileRow>();

    profiles.forEach((profile) => {
      profileMap.set(profile.id, profile);
    });

    const users = authUsers
      .map((user) => {
        const profile = profileMap.get(user.id);
        const role = normalizeRole(profile?.role);
        const isActive = profile?.is_active !== false;

        return {
          id: user.id,
          email: String(user.email || "").trim().toLowerCase(),
          created_at: user.created_at || null,
          last_sign_in_at: user.last_sign_in_at || null,
          email_confirmed_at: user.email_confirmed_at || null,
          full_name: profile?.full_name || null,
          phone: profile?.phone || null,
          city: profile?.city || null,
          address_line1: profile?.address_line1 || null,
          role,
          is_active: isActive,
          profile_updated_at: profile?.updated_at || null,
          has_profile: Boolean(profile),
        };
      })
      .filter((user) => {
        const profile = profileMap.get(user.id);

        if (!userMatchesSearch(user, profile, search)) {
          return false;
        }

        if (roleFilter !== "all" && user.role !== roleFilter) {
          return false;
        }

        if (activeFilter === "active" && !user.is_active) {
          return false;
        }

        if (activeFilter === "inactive" && user.is_active) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });

    const summary = {
      total: users.length,
      active: users.filter((user) => user.is_active).length,
      inactive: users.filter((user) => !user.is_active).length,
      admin: users.filter((user) => user.role === "admin").length,
      manager: users.filter((user) => user.role === "manager").length,
      support: users.filter((user) => user.role === "support").length,
      customer: users.filter((user) => user.role === "customer").length,
    };

    return NextResponse.json({
      admin: admin.user,
      users,
      summary,
      filters: {
        search,
        role: roleFilter,
        active: activeFilter,
      },
      can_view_users: userCanViewUsers,
      can_manage_users: userCanManageUsers,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || "Failed to load users.",
      },
      { status: 500 }
    );
  }
}