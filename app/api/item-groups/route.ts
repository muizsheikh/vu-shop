export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const ERP_BASE = process.env.ERP_BASE_URL || "";
const ERP_KEY = process.env.ERP_API_KEY || "";
const ERP_SECRET = process.env.ERP_API_SECRET || "";

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `token ${ERP_KEY}:${ERP_SECRET}`,
  };
}

async function erpGetList(doctype: string, body: Record<string, any>) {
  const res = await fetch(`${ERP_BASE}/api/method/frappe.client.get_list`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ doctype, ...body }),
    cache: "no-store",
  });
  const json = await res.json();
  return (json?.message ?? []) as any[];
}

export async function GET() {
  try {
    const groups = await erpGetList("Item Group", {
      fields: ["name", "item_group_name"],
      filters: [["is_group", "=", 0]],
      order_by: "item_group_name asc",
      limit_page_length: 100,
    });

    return NextResponse.json({
      groups: groups.map((g) => ({
        name: g.name,
        label: g.item_group_name || g.name,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
