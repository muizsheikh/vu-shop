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

export type AdminPermission =
  | "canAccessAdmin"
  | "canManageUsers"
  | "canViewUsers"
  | "canUpdateOrders"
  | "canViewOrders"
  | "canExportOrders"
  | "canViewReports"
  | "canManageSettings"
  | "canViewCustomers"
  | "canManageDelivery";

export type PermissionMatrix = Record<AdminPermission, boolean>;

export const DEFAULT_PERMISSION_MATRIX: PermissionMatrix = {
  canAccessAdmin: false,
  canManageUsers: false,
  canViewUsers: false,
  canUpdateOrders: false,
  canViewOrders: false,
  canExportOrders: false,
  canViewReports: false,
  canManageSettings: false,
  canViewCustomers: false,
  canManageDelivery: false,
};

const ROLE_PERMISSION_MATRIX: Record<AdminRole, PermissionMatrix> = {
  admin: {
    canAccessAdmin: true,
    canManageUsers: true,
    canViewUsers: true,
    canUpdateOrders: true,
    canViewOrders: true,
    canExportOrders: true,
    canViewReports: true,
    canManageSettings: true,
    canViewCustomers: true,
    canManageDelivery: true,
  },

  manager: {
    canAccessAdmin: true,
    canManageUsers: false,
    canViewUsers: true,
    canUpdateOrders: true,
    canViewOrders: true,
    canExportOrders: true,
    canViewReports: true,
    canManageSettings: false,
    canViewCustomers: true,
    canManageDelivery: true,
  },

  support: {
    canAccessAdmin: true,
    canManageUsers: false,
    canViewUsers: false,
    canUpdateOrders: true,
    canViewOrders: true,
    canExportOrders: false,
    canViewReports: false,
    canManageSettings: false,
    canViewCustomers: true,
    canManageDelivery: true,
  },
};

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

export function getRolePermissions(
  role: string | null | undefined
): PermissionMatrix {
  const normalized = normalizeRole(role);

  if (!isAllowedAdminRole(normalized)) {
    return DEFAULT_PERMISSION_MATRIX;
  }

  return ROLE_PERMISSION_MATRIX[normalized as AdminRole];
}

export function hasAdminPermission(
  role: string | null | undefined,
  permission: AdminPermission
) {
  const permissions = getRolePermissions(role);
  return Boolean(permissions[permission]);
}

export function canAccessAdmin(role: string | null | undefined) {
  return hasAdminPermission(role, "canAccessAdmin");
}

export function canManageUsers(role: string | null | undefined) {
  return hasAdminPermission(role, "canManageUsers");
}

export function canViewUsers(role: string | null | undefined) {
  return hasAdminPermission(role, "canViewUsers");
}

export function canViewOrders(role: string | null | undefined) {
  return hasAdminPermission(role, "canViewOrders");
}

export function canUpdateOrders(role: string | null | undefined) {
  return hasAdminPermission(role, "canUpdateOrders");
}

export function canExportOrders(role: string | null | undefined) {
  return hasAdminPermission(role, "canExportOrders");
}

export function canViewReports(role: string | null | undefined) {
  return hasAdminPermission(role, "canViewReports");
}

export function canManageSettings(role: string | null | undefined) {
  return hasAdminPermission(role, "canManageSettings");
}

export function canViewCustomers(role: string | null | undefined) {
  return hasAdminPermission(role, "canViewCustomers");
}

export function canManageDelivery(role: string | null | undefined) {
  return hasAdminPermission(role, "canManageDelivery");
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