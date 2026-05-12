import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAdminUserFromRequest } from "@/lib/adminAuth";

async function loadNotes(orderId: string) {
  const { data, error } = await supabaseAdmin
    .from("order_admin_notes")
    .select("id, order_id, note, created_by_email, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load admin notes.");
  }

  return data || [];
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUserFromRequest(req);

    if (!admin.ok) {
      return NextResponse.json(
        { error: admin.message },
        { status: admin.status }
      );
    }

    const { id } = await context.params;
    const notes = await loadNotes(id);

    return NextResponse.json({
      notes,
      admin: admin.user,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message || "Something went wrong while loading admin notes.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUserFromRequest(req);

    if (!admin.ok) {
      return NextResponse.json(
        { error: admin.message },
        { status: admin.status }
      );
    }

    const { id } = await context.params;
    const body = await req.json().catch(() => null);
    const note = String(body?.note || "").trim();

    if (!note) {
      return NextResponse.json(
        { error: "Note is required." },
        { status: 400 }
      );
    }

    if (note.length > 1200) {
      return NextResponse.json(
        { error: "Note must be 1200 characters or less." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("order_admin_notes").insert({
      order_id: id,
      note,
      created_by_email: admin.user.email,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to save admin note." },
        { status: 500 }
      );
    }

    const notes = await loadNotes(id);

    return NextResponse.json({
      notes,
      admin: admin.user,
      message: "Admin note saved successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message || "Something went wrong while saving admin note.",
      },
      { status: 500 }
    );
  }
}