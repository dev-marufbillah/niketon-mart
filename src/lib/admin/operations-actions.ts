"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/session";
import { logActivity } from "@/lib/repositories/activity";
import {
  orderStatuses,
  updateOrderStatus,
  type OrderStatus,
} from "@/lib/repositories/orders";
import { adjustStock } from "@/lib/repositories/inventory";
import { updateCustomer } from "@/lib/repositories/customers";

export type AdminFormState = { errors?: string[]; success?: string } | null;

/* -------------------------------------------------------------------------- */
/* Orders                                                                      */
/* -------------------------------------------------------------------------- */

export async function updateOrderAction(
  id: string,
  _state: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const user = await assertPermission("orders.manage");

  const status = String(formData.get("status") ?? "") as OrderStatus;
  const deliveryPartnerId = String(formData.get("deliveryPartnerId") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (status && !orderStatuses.some((entry) => entry.value === status)) {
    return { errors: ["Choose a valid order status."] };
  }
  if (formData.has("paymentStatus")) return { errors: ["Payment decisions must be recorded in payment verification by an authorised user."] };

  const result = await updateOrderStatus(
    id,
    {
      ...(status ? { status } : {}),
      ...(deliveryPartnerId ? { deliveryPartnerId } : {}),
      ...(note ? { note } : {}),
    },
    user.name,
  );

  if (!result.ok) return { errors: [result.error] };

  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "order",
    entity: "orders",
    entityId: id,
    summary: `Order ${result.order.number}: ${status || "updated"}${note ? ` — ${note}` : ""}`,
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin");
  return { success: "Order updated." };
}

/* -------------------------------------------------------------------------- */
/* Inventory                                                                   */
/* -------------------------------------------------------------------------- */

export async function adjustStockAction(
  _state: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const user = await assertPermission("inventory.manage");
  const productId = String(formData.get("productId") ?? "");
  const type = String(formData.get("type") ?? "delta") === "absolute" ? "absolute" : "delta";
  const rawValue = String(formData.get("value") ?? "").trim();
  const value = Number(rawValue);
  const rawExpected = String(formData.get("expectedStock") ?? "").trim();
  const expectedStock = rawExpected ? Number(rawExpected) : undefined;
  const reason = String(formData.get("reason") ?? "admin-adjustment");
  const note = String(formData.get("note") ?? "").trim();

  if (!productId) return { errors: ["Choose a product to adjust."] };
  if (!rawValue || !Number.isSafeInteger(value) || (type === "delta" && value === 0) || (type === "absolute" && value < 0)) {
    return { errors: [type === "absolute" ? "Enter a non-negative whole-number stock level." : "Enter a non-zero whole-number change."] };
  }
  if (!["admin-adjustment", "restock", "damaged", "returned", "initial-stock"].includes(reason)) {
    return { errors: ["Choose a valid stock change reason."] };
  }

  const result = await adjustStock({
    productId,
    change: { type, value },
    expectedStock,
    reason,
    note,
    actor: user.name,
  });
  if (!result.ok) return { errors: [result.error] };

  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "stock",
    entity: "products",
    entityId: productId,
    summary: `${type === "absolute" ? "Set" : "Adjusted"} stock of “${result.product.name}” (${reason})${
      note ? ` — ${note}` : ""
    }`,
  });

  revalidatePath("/admin/inventory");
  revalidatePath("/home-grocery");
  return { success: `Stock updated for ${result.product.name}.` };
}

/* -------------------------------------------------------------------------- */
/* Customers                                                                   */
/* -------------------------------------------------------------------------- */

export async function updateCustomerAction(
  id: string,
  _state: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const user = await assertPermission("customers.manage");

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const area = String(formData.get("area") ?? "").trim();
  const status = String(formData.get("status") ?? "active");
  const notes = String(formData.get("notes") ?? "").trim();

  const errors: string[] = [];
  if (name.length < 2) errors.push("Customer name is required.");
  if (phone.replace(/\D/g, "").length < 7) errors.push("Enter a valid phone number.");
  if (!["active", "blocked"].includes(status)) errors.push("Choose a valid account status.");
  if (errors.length) return { errors };

  const updated = await updateCustomer(id, {
    name,
    phone,
    address,
    area,
    status: status as "active" | "blocked",
    notes,
  });
  if (!updated) return { errors: ["That customer no longer exists."] };
  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "customer",
    entity: "customers",
    entityId: id,
    summary: `Updated customer “${name}”`,
  });

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${id}`);
  return { success: "Customer saved." };
}

