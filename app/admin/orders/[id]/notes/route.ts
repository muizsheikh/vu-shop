import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const authClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function getAdminUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return {
      ok: false as const,
      status: 401,
      message: "Missing authorization token.",
    };
  }

  const { data, error } = await authClient.auth.getUser(token);

  if (error || !data.user) {
    return {
      ok: false as const,
      status: 401,
      message: "Invalid or expired session.",
    };
  }

  if (!isAdminEmail(data.user.email)) {
    return {
      ok: false as const,
      status: 403,
      message: "You are not allowed to access admin notes.",
    };
  }

  return {
    ok: true as const,
    user: data.user,
  };
}

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
    const admin = await getAdminUser(req);

    if (!admin.ok) {
      return NextResponse.json(
        { error: admin.message },
        { status: admin.status }
      );
    }

    const { id } = await context.params;

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("id", id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: orderError?.message || "Order not found." },
        { status: 404 }
      );
    }

    const notes = await loadNotes(id);

    return NextResponse.json({ notes });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Something went wrong while loading admin notes.",
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
    const admin = await getAdminUser(req);

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
        { error: "Note is too long. Maximum 1200 characters allowed." },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("id", id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: orderError?.message || "Order not found." },
        { status: 404 }
      );
    }

    const createdByEmail = String(admin.user.email || "").trim().toLowerCase();

    const { error } = await supabaseAdmin.from("order_admin_notes").insert({
      order_id: id,
      note,
      created_by_email: createdByEmail,
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
      message: "Admin note saved successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Something went wrong while saving admin note.",
      },
      { status: 500 }
    );
  }
}