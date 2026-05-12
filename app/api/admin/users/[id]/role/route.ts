import { NextRequest, NextResponse } from "next/server";
import { getAdminUserFromRequest } from "@/lib/adminAuth";
import { ADMIN_ROLES, normalizeRole } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_PROFILE_ROLES = ["customer", ...ADMIN_ROLES];

function isAllowedProfileRole(role: string) {
  return ALLOWED_PROFILE_ROLES.includes(role as any);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    if (admin.user.role !== "admin") {
      return NextResponse.json(
        {
          error: "Only admin users can manage roles and account status.",
        },
        { status: 403 }
      );
    }

    const { id } = await params;
    const targetUserId = String(id || "").trim();

    if (!targetUserId) {
      return NextResponse.json(
        {
          error: "User ID is required.",
        },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const nextRole =
      body?.role === undefined ? undefined : normalizeRole(body.role);

    const nextIsActive =
      body?.is_active === undefined ? undefined : Boolean(body.is_active);

    if (nextRole !== undefined && !isAllowedProfileRole(nextRole)) {
      return NextResponse.json(
        {
          error: "Invalid role selected.",
        },
        { status: 400 }
      );
    }

    if (admin.user.id === targetUserId) {
      if (nextRole !== undefined && nextRole !== "admin") {
        return NextResponse.json(
          {
            error: "You cannot remove your own admin role.",
          },
          { status: 400 }
        );
      }

      if (nextIsActive === false) {
        return NextResponse.json(
          {
            error: "You cannot disable your own account.",
          },
          { status: 400 }
        );
      }
    }

    const { data: targetUser, error: targetUserError } =
      await supabaseAdmin.auth.admin.getUserById(targetUserId);

    if (targetUserError || !targetUser?.user) {
      return NextResponse.json(
        {
          error: "User not found.",
        },
        { status: 404 }
      );
    }

    const updatePayload: Record<string, any> = {
      id: targetUserId,
      updated_at: new Date().toISOString(),
    };

    if (nextRole !== undefined) {
      updatePayload.role = nextRole;
    }

    if (nextIsActive !== undefined) {
      updatePayload.is_active = nextIsActive;
    }

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from("profiles")
      .upsert(updatePayload, {
        onConflict: "id",
      })
      .select("id, full_name, phone, city, address_line1, role, is_active, updated_at")
      .single();

    if (updateError) {
      throw new Error(updateError.message || "Failed to update user profile.");
    }

    return NextResponse.json({
      admin: admin.user,
      user: {
        id: targetUser.user.id,
        email: String(targetUser.user.email || "").trim().toLowerCase(),
        created_at: targetUser.user.created_at || null,
        last_sign_in_at: targetUser.user.last_sign_in_at || null,
        email_confirmed_at: targetUser.user.email_confirmed_at || null,
        full_name: updatedProfile?.full_name || null,
        phone: updatedProfile?.phone || null,
        city: updatedProfile?.city || null,
        address_line1: updatedProfile?.address_line1 || null,
        role: normalizeRole(updatedProfile?.role),
        is_active: updatedProfile?.is_active !== false,
        profile_updated_at: updatedProfile?.updated_at || null,
        has_profile: true,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || "Failed to update user role.",
      },
      { status: 500 }
    );
  }
}