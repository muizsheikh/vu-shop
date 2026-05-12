export const ADMIN_EMAILS = ["info@vapeustad.com", "muizsheikh@gmail.com"];

export const ADMIN_ROLES = ["admin", "support", "manager"] as const;

export const ORDER_STATUSES = [
  "placed",
  "confirmed",
  "processing",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function normalizeAdminEmail(email: string | null | undefined) {
  return String(email || "").trim().toLowerCase();
}

export function isAdminEmail(email: string | null | undefined) {
  return ADMIN_EMAILS.includes(normalizeAdminEmail(email));
}

export function normalizeRole(role: string | null | undefined) {
  return String(role || "customer").trim().toLowerCase();
}

export function isAllowedAdminRole(role: string | null | undefined) {
  const normalized = normalizeRole(role);
  return ADMIN_ROLES.includes(normalized as AdminRole);
}

export function normalizeOrderStatus(status: string | null | undefined) {
  const normalized = String(status || "placed")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");

  if (ORDER_STATUSES.includes(normalized as OrderStatus)) {
    return normalized as OrderStatus;
  }

  return "placed";
}

export function getOrderStatusLabel(status: string | null | undefined) {
  const normalized = normalizeOrderStatus(status);

  if (normalized === "out_for_delivery") return "Out for Delivery";

  return normalized
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}