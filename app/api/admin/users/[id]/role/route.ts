import { NextRequest, NextResponse } from "next/server";
import { getAdminUserFromRequest } from "@/lib/adminAuth";
import {
  ADMIN_ROLES,
  canManageUsers,
  normalizeRole,
} from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_PROFILE_ROLES = ["customer", ...ADMIN_ROLES];

function isAllowedProfileRole(role: string) {
  return ALLOWED_PROFILE_ROLES.includes(role as any);
}

function buildUserResponse(targetUser: any, profile: any) {
  return {
    id: targetUser.user.id,
    email: String(targetUser.user.email || "").trim().toLowerCase(),
    created_at: targetUser.user.created_at || null,
    last_sign_in_at: targetUser.user.last_sign_in_at || null,
    email_confirmed_at: targetUser.user.email_confirmed_at || null,
    full_name: profile?.full_name || null,
    phone: profile?.phone || null,
    city: profile?.city || null,
    address_line1: profile?.address_line1 || null,
    role: normalizeRole(profile?.role),
    is_active: profile?.is_active !== false,
    profile_updated_at: profile?.updated_at || null,
    has_profile: Boolean(profile),
  };
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

    if (!canManageUsers(admin.user.role)) {
      return NextResponse.json(
        {
          error: "You do not have permission to manage user roles or account status.",
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

    const { data: currentProfile, error: currentProfileError } =
      await supabaseAdmin
        .from("profiles")
        .select(
          "id, full_name, phone, city, address_line1, role, is_active, updated_at"
        )
        .eq("id", targetUserId)
        .maybeSingle();

    if (currentProfileError) {
      throw new Error(
        currentProfileError.message || "Failed to load current user profile."
      );
    }

    const oldRole = normalizeRole(currentProfile?.role);
    const oldIsActive = currentProfile?.is_active !== false;

    const finalRole = nextRole !== undefined ? nextRole : oldRole;
    const finalIsActive =
      nextIsActive !== undefined ? nextIsActive : oldIsActive;

    const roleChanged = finalRole !== oldRole;
    const activeChanged = finalIsActive !== oldIsActive;

    if (!roleChanged && !activeChanged) {
      return NextResponse.json({
        admin: admin.user,
        user: buildUserResponse(targetUser, {
          ...currentProfile,
          role: oldRole,
          is_active: oldIsActive,
        }),
        audit_logged: false,
        message: "No changes were required.",
      });
    }

    const updatePayload: Record<string, any> = {
      id: targetUserId,
      updated_at: new Date().toISOString(),
    };

    if (nextRole !== undefined) {
      updatePayload.role = finalRole;
    }

    if (nextIsActive !== undefined) {
      updatePayload.is_active = finalIsActive;
    }

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from("profiles")
      .upsert(updatePayload, {
        onConflict: "id",
      })
      .select(
        "id, full_name, phone, city, address_line1, role, is_active, updated_at"
      )
      .single();

    if (updateError) {
      throw new Error(updateError.message || "Failed to update user profile.");
    }

    const { error: auditError } = await supabaseAdmin
      .from("user_role_history")
      .insert({
        target_user_id: targetUserId,
        old_role: oldRole,
        new_role: normalizeRole(updatedProfile?.role),
        old_is_active: oldIsActive,
        new_is_active: updatedProfile?.is_active !== false,
        changed_by_user_id: admin.user.id,
        changed_by_email: admin.user.email,
      });

    if (auditError) {
      throw new Error(auditError.message || "Failed to save user audit log.");
    }

    return NextResponse.json({
      admin: admin.user,
      audit_logged: true,
      user: buildUserResponse(targetUser, updatedProfile),
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