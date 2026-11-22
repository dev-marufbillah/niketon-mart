import "server-only";

import { ensureDatabase } from "@/lib/db";
import type { Database, Row } from "@/lib/db/types";
import type { Order } from "@/lib/repositories/orders";
import { isSafeTakaAmount, toPoisha } from "@/lib/utils/currency";
import { newCustomerSessionVersion } from "@/lib/auth/customer-credentials";
import type { CustomerProfile } from "@/lib/repositories/accounts";

/**
 * Customers are created automatically from orders and can then be managed
 * (status, notes, contact details) from the admin panel. A customer record is
 * keyed by email so repeat orders accumulate on one profile.
 */

export type Customer = Row & {
  name: string;
  email: string;
  phone: string;
  address: string;
  area?: string;
  status: "active" | "blocked";
  notes?: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt?: string;
  createdAt: string;
  updatedAt: string;
};

export async function listCustomers() {
  const db = await ensureDatabase();
  const customers = await db.list<Customer>("customers");
  return customers.sort((a, b) => (a.lastOrderAt ?? a.createdAt) < (b.lastOrderAt ?? b.createdAt) ? 1 : -1);
}

export async function getCustomer(id: string) {
  const db = await ensureDatabase();
  return db.get<Customer>("customers", id);
}

export async function upsertCustomerFromOrder(order: Order, transaction?: Database): Promise<Customer> {
  const db = transaction ?? await ensureDatabase();
  const email = order.customer.email.toLowerCase();
  // A guest must not mutate or acquire ownership of a registered account just
  // by typing its email at checkout. Reuse only a guest-only customer record.
  const existing = (await db.list<Customer & { passwordHash?: string; googleSubjectHash?: string | null; staffAdminId?: string }>("customers", { where: { email } }))
    .find((customer) => !customer.passwordHash && !customer.googleSubjectHash && !customer.staffAdminId);
  const now = new Date().toISOString();

  if (!existing) {
    return db.insert<Customer>("customers", {
      name: order.customer.name,
      email,
      phone: order.customer.phone,
      address: order.customer.address,
      area: order.customer.area,
      status: "active",
      notes: order.customer.notes ?? "",
      orderCount: 1,
      totalSpent: order.total,
      lastOrderAt: order.createdAt,
      createdAt: now,
      updatedAt: now,
    });
  }

  return (await db.update<Customer>("customers", existing.id, {
    name: order.customer.name || existing.name,
    phone: order.customer.phone || existing.phone,
    address: order.customer.address || existing.address,
    area: order.customer.area ?? existing.area,
    orderCount: existing.orderCount + 1,
    totalSpent: Math.round((existing.totalSpent + order.total) * 100) / 100,
    lastOrderAt: order.createdAt,
    updatedAt: now,
  }))!;
}

/**
 * Adds an order to the account that placed it (signed-in checkout).
 * The contact details on the customer record follow the latest order, but the
 * order keeps its own snapshot, so an address change never rewrites history.
 */
export async function recordOrderForCustomer(
  customerId: string,
  order: Order,
  transaction?: Database,
): Promise<Customer | null> {
  const db = transaction ?? await ensureDatabase();
  const existing = await db.get<Customer>("customers", customerId);
  if (!existing) return null;
  const count = existing.orderCount ?? 0;
  const spent = existing.totalSpent ?? 0;
  if (!Number.isSafeInteger(count) || count < 0 || count >= Number.MAX_SAFE_INTEGER ||
      !isSafeTakaAmount(spent) || !isSafeTakaAmount(order.total)) return null;
  const totalPoisha = toPoisha(spent) + toPoisha(order.total);
  if (!Number.isSafeInteger(totalPoisha) || !isSafeTakaAmount(totalPoisha / 100)) return null;
  return db.update<Customer>("customers", customerId, {
    name: order.customer.name || existing.name,
    phone: order.customer.phone || existing.phone,
    address: order.customer.address || existing.address,
    area: order.customer.area ?? existing.area,
    orderCount: count + 1,
    totalSpent: totalPoisha / 100,
    lastOrderAt: order.createdAt,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateCustomerInDatabase(
  db: Database, id: string,
  patch: Partial<Pick<Customer, "name" | "phone" | "address" | "area" | "status" | "notes">>,
): Promise<Customer | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await db.get<CustomerProfile>("customers", id);
    if (!current) return null;
    const statusChanged = patch.status !== undefined && patch.status !== current.status;
    const result = await db.compareAndUpdate<CustomerProfile>("customers", id,
      { status: current.status, sessionVersion: current.sessionVersion }, {
        ...patch, updatedAt: new Date().toISOString(),
        ...(statusChanged ? {
          sessionVersion: newCustomerSessionVersion(),
          passwordResetHash: null, passwordResetEmail: null, passwordResetExpiresAt: null,
          emailVerificationHash: null, emailVerificationFrom: null, emailVerificationTarget: null, emailVerificationExpiresAt: null,
        } : {}),
      });
    if (result) return result;
  }
  throw new Error("Customer changed while saving. Refresh and try again.");
}

export async function updateCustomer(
  id: string,
  patch: Partial<Pick<Customer, "name" | "phone" | "address" | "area" | "status" | "notes">>,
) {
  return updateCustomerInDatabase(await ensureDatabase(), id, patch);
}

export async function getCustomerOrders(email: string, customerId?: string) {
  const db = await ensureDatabase();
  const orders = await db.list<Order>("orders");
  // Email alone is not proof of ownership, even in an admin detail view.
  void email;
  return orders.filter((order) => Boolean(customerId) && order.customerId === customerId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getCustomerStats() {
  const customers = await listCustomers();
  return {
    customers,
    total: customers.length,
    active: customers.filter((customer) => customer.status === "active").length,
    blocked: customers.filter((customer) => customer.status === "blocked").length,
    returning: customers.filter((customer) => customer.orderCount > 1).length,
    lifetimeValue:
      customers.reduce((total, customer) => total + customer.totalSpent, 0) / Math.max(1, customers.length),
  };
}
