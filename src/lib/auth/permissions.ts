/** Shared role definitions. Server sessions are the authority, not form inputs. */
export const PERMISSIONS = [
  "dashboard.view", "orders.view", "orders.manage", "customers.view", "customers.manage",
  "products.view", "products.manage", "inventory.manage", "content.view", "content.manage",
  "marketing.manage", "delivery.manage", "payments.manage", "media.manage",
  "settings.manage", "users.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];
export type AdminRole = "owner" | "admin" | "manager" | "editor" | "fulfilment" |
  "product_manager" | "order_manager" | "inventory_manager" | "customer_support" | "content_manager" | "custom";

const withoutUserManagement = PERMISSIONS.filter((permission) => permission !== "users.manage");
export const roleDefinitions: Record<AdminRole, { label: string; description: string; permissions: Permission[] }> = {
  owner: { label: "Super Admin", description: "Protected installation owner with full access.", permissions: [...PERMISSIONS] },
  admin: { label: "Admin", description: "Store administration, but no control of admin accounts.", permissions: withoutUserManagement },
  manager: { label: "Manager", description: "Store operations, but no control of admin accounts.", permissions: withoutUserManagement },
  product_manager: { label: "Product Manager", description: "Products, categories, preparation and media.", permissions: ["dashboard.view", "products.view", "products.manage", "media.manage"] },
  order_manager: { label: "Order Manager", description: "Orders and delivery.", permissions: ["dashboard.view", "orders.view", "orders.manage", "delivery.manage"] },
  inventory_manager: { label: "Inventory Manager", description: "Catalogue viewing and stock adjustments.", permissions: ["dashboard.view", "products.view", "inventory.manage"] },
  customer_support: { label: "Customer Support", description: "Customer and order support.", permissions: ["dashboard.view", "orders.view", "customers.view", "customers.manage"] },
  content_manager: { label: "Content Manager", description: "Website content, marketing and media.", permissions: ["dashboard.view", "content.view", "content.manage", "marketing.manage", "media.manage"] },
  editor: { label: "Content editor (legacy)", description: "Content, products, marketing and media.", permissions: ["dashboard.view", "content.view", "content.manage", "products.view", "marketing.manage", "media.manage"] },
  fulfilment: { label: "Fulfilment (legacy)", description: "Orders, stock and deliveries.", permissions: ["dashboard.view", "orders.view", "orders.manage", "customers.view", "products.view", "inventory.manage", "delivery.manage"] },
  custom: { label: "Custom", description: "Permissions explicitly selected by the Super Admin.", permissions: [] },
};

type Subject = AdminRole | { role: AdminRole; permissions?: Permission[] };
export function can(subject: Subject, permission: Permission): boolean {
  const role = typeof subject === "string" ? subject : subject.role;
  // Admin user management can never be delegated to ordinary roles.
  if (permission === "users.manage") return role === "owner";
  if (role === "custom") {
    return typeof subject !== "string" && (subject.permissions ?? []).includes(permission);
  }
  return roleDefinitions[role]?.permissions.includes(permission) ?? false;
}
export function canView(subject: Subject, permission: Permission): boolean {
  if (can(subject, permission)) return true;
  const view = permission.replace(/\.manage$/, ".view") as Permission;
  return view !== permission && PERMISSIONS.includes(view) && can(subject, view);
}
export const roleOptions = (Object.keys(roleDefinitions) as AdminRole[]).map((role) => ({ value: role, label: roleDefinitions[role].label }));
