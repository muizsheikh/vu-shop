// /app/api/cod/route.ts
import { NextResponse } from "next/server";

// ----- Config -----
const ONLINE_ITEM = process.env.ERP_ONLINE_ITEM_CODE || "ONLINE-SALE";

// ----- ERPNext fetch wrapper -----
async function erpnextFetch(path: string, opts: any = {}) {
  const base = process.env.ERP_BASE_URL; // e.g. https://vapeustadcloud.com
  const key = process.env.ERP_API_KEY;
  const secret = process.env.ERP_API_SECRET;
  if (!base || !key || !secret) {
    throw new Error("ERP credentials missing (ERP_BASE_URL, ERP_API_KEY, ERP_API_SECRET)");
  }
  const url =
    path.startsWith("http") || path.startsWith("/")
      ? `${base}${path}`
      : `${base}/api/resource/${path}`;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `token ${key}:${secret}`,
    ...opts.headers,
  };

  const res = await fetch(url, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.message || JSON.stringify(data);
    throw new Error(msg);
  }
  return data;
}

// Ensure "ONLINE-SALE" item exists (non-stock)
async function ensureOnlineSaleItem() {
  const q = await erpnextFetch(
    `Item?fields=["name"]&filters=${encodeURIComponent(
      JSON.stringify([["item_code", "=", ONLINE_ITEM]])
    )}`
  );
  if (q?.data?.length) return q.data[0].name;

  const created = await erpnextFetch("Item", {
    method: "POST",
    body: JSON.stringify({
      item_code: ONLINE_ITEM,
      item_name: ONLINE_ITEM,
      item_group: "All Item Groups",
      stock_uom: "Nos",
      is_stock_item: 0,
      include_item_in_manufacturing: 0,
      disabled: 0,
    }),
  });
  return created.data.name;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items = body.items || [];
    const customer = body.customer || {};

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Cart empty" }, { status: 400 });
    }

    const cname = (customer.name || "Guest Checkout").trim();
    const cemail = (customer.email || "guest@vapeustad.com").trim();
    const cphone = (customer.phone || "").trim();
    const addr1 = (customer.address_line1 || "").trim();
    const city = (customer.city || "").trim();
    const country = (customer.country || "Pakistan").trim();

    // 1) Ensure Customer (by email)
    let customerId: string;
    try {
      const q = await erpnextFetch(
        `Customer?filters=${encodeURIComponent(JSON.stringify([["email_id", "=", cemail]]))}`
      );
      if (q?.data?.length) {
        customerId = q.data[0].name;
        // optional: update phone
        await erpnextFetch(`Customer/${customerId}`, {
          method: "PUT",
          body: JSON.stringify({ mobile_no: cphone || undefined }),
        }).catch(() => {});
      } else {
        const create = await erpnextFetch("Customer", {
          method: "POST",
          body: JSON.stringify({
            customer_name: cname,
            customer_type: "Individual",
            email_id: cemail,
            mobile_no: cphone || undefined,
            customer_group: "All Customer Groups",
            territory: "All Territories",
          }),
        });
        customerId = create.data.name;
      }
    } catch (err) {
      console.error("Customer ensure error", err);
      return NextResponse.json({ error: "Failed to ensure customer" }, { status: 500 });
    }

    // 2) Optional shipping address linked to Customer
    let shippingAddressName: string | undefined = undefined;
    if (addr1 && city) {
      try {
        const addrPayload = {
          address_title: cname || customerId,
          address_type: "Shipping",
          address_line1: addr1,
          city,
          country,
          phone: cphone || undefined,
          links: [{ link_doctype: "Customer", link_name: customerId }],
        };
        const created = await erpnextFetch("Address", {
          method: "POST",
          body: JSON.stringify(addrPayload),
        });
        shippingAddressName = created?.data?.name;
      } catch (e) {
        console.warn("Address create warning:", (e as Error).message);
      }
    }

    // 3) Ensure ONLINE-SALE item exists
    await ensureOnlineSaleItem();

    // 4) Aggregate totals + description
    const grandTotal = items.reduce(
      (sum: number, it: any) => sum + Number(it.price) * Number(it.qty),
      0
    );
    const summary = items
      .map(
        (it: any) =>
          `• ${it.name} × ${it.qty} @ Rs ${Number(it.price).toLocaleString()} = Rs ${(
            Number(it.price) * Number(it.qty)
          ).toLocaleString()}`
      )
      .join("\n");

    // 5) Build SO payload with single ONLINE-SALE line
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 1);

    const soPayload: any = {
      customer: customerId,
      transaction_date: new Date().toISOString().slice(0, 10),
      delivery_date: deliveryDate.toISOString().slice(0, 10),
      currency: "PKR",
      conversion_rate: 1,
      items: [
        {
          item_code: ONLINE_ITEM,
          qty: 1,
          rate: grandTotal,
          description: `Website Order\n${summary}`,
        },
      ],
    };
    if (shippingAddressName) soPayload.shipping_address_name = shippingAddressName;

    // 6) Create SO
    const so = await erpnextFetch("Sales Order", {
      method: "POST",
      body: JSON.stringify(soPayload),
    });

    console.log("✅ COD Sales Order created", so.data.name);
    return NextResponse.json({ success: true, so: so.data.name });
  } catch (err: any) {
    console.error("❌ COD API error", err);
    return NextResponse.json({ error: err.message || "COD failed" }, { status: 500 });
  }
}
