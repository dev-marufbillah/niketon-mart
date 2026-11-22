"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/session";
import { revokeCustomerSessions } from "@/lib/auth/customer";
import { getProfile, setDefaultAddress } from "@/lib/repositories/accounts";
import {
  createAddress,
  deleteAddress,
  getAddress,
  updateAddress,
  type AddressInput,
} from "@/lib/repositories/accounts";
import { logActivity } from "@/lib/repositories/activity";
import { getDeliveryAreas } from "@/lib/repositories/operations";

/**
 * Admin-side management of a customer's account.
 *
 * Deliberately narrow: staff can correct a customer's saved addresses and end
 * their sessions (the two things that actually come up on the phone), but they
 * can never read or set a password. Customer self-service keeps ownership of
 * credentials — the rule in AGENTS.md.
 */

export type AdminCustomerState = { errors?: string[]; success?: string } | null;

async function guardCustomer(customerId: string) {
  const user = await assertPermission("customers.manage");
  const profile = await getProfile(customerId);
  if (!profile) redirect("/admin/customers");
  return { user, profile };
}

function readAddress(formData: FormData): AddressInput {
  return {
    label: String(formData.get("label") ?? "").trim(),
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    company: String(formData.get("company") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    addressLine2: String(formData.get("addressLine2") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    postalCode: String(formData.get("postalCode") ?? "").trim(),
    areaId: String(formData.get("areaId") ?? "").trim(),
  };
}

export async function adminSaveCustomerAddressAction(
  customerId: string,
  _state: AdminCustomerState,
  formData: FormData,
): Promise<AdminCustomerState> {
  const { user } = await guardCustomer(customerId);
  const areas = await getDeliveryAreas();
  const input = readAddress(formData);

  const errors: string[] = [];
  if (input.firstName.length < 2) errors.push("Enter the recipient's first name.");
  if (input.lastName.length < 2) errors.push("Enter the recipient's last name.");
  if (input.phone.replace(/\D/g, "").length < 7) errors.push("Enter a contact phone number.");
  if (input.address.length < 8) errors.push("Enter the full street address.");
  if (!areas.some((area) => area.id === input.areaId)) errors.push("Choose a delivery area.");
  if (errors.length) return { errors };

  const id = String(formData.get("id") ?? "").trim();
  const patch = {
    ...input,
    isDefaultShipping: formData.get("isDefaultShipping") === "on",
    isDefaultBilling: formData.get("isDefaultBilling") === "on",
  };

  if (id) {
    if (!(await getAddress(customerId, id))) return { errors: ["That address no longer exists."] };
    await updateAddress(customerId, id, patch);
  } else {
    await createAddress(customerId, patch);
  }

  await logActivity({
    actor: { id: user.id, name: user.name },
    action: id ? "update" : "create",
    entity: "customer_addresses",
    entityId: id || customerId,
    summary: `${user.name} ${id ? "edited" : "added"} an address for a customer`,
  });

  revalidatePath(`/admin/customers/${customerId}`);
  return { success: id ? "Address updated." : "Address added." };
}

export async function adminDeleteCustomerAddressAction(customerId: string, formData: FormData): Promise<void> {
  const { user } = await guardCustomer(customerId);
  const id = String(formData.get("id") ?? "");
  if (id) await deleteAddress(customerId, id);
  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "delete",
    entity: "customer_addresses",
    entityId: id,
    summary: `${user.name} deleted a customer address`,
  });
  revalidatePath(`/admin/customers/${customerId}`);
}

export async function adminSetDefaultCustomerAddressAction(customerId: string, formData: FormData): Promise<void> {
  const { user } = await guardCustomer(customerId);
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "shipping") === "billing" ? "billing" : "shipping";
  if (id && await getAddress(customerId, id)) {
    await setDefaultAddress(customerId, id, kind);
    await logActivity({ actor: { id: user.id, name: user.name }, action: "update", entity: "customer_addresses", entityId: id, summary: `${user.name} updated a customer's default ${kind} address` });
  }
  revalidatePath(`/admin/customers/${customerId}`);
}

/** Ends every signed-in session for this customer. */
export async function adminRevokeCustomerSessionsAction(customerId: string): Promise<void> {
  const { user } = await guardCustomer(customerId);
  const count = await revokeCustomerSessions(customerId);
  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "revoke-sessions",
    entity: "customers",
    entityId: customerId,
    summary: `${user.name} signed a customer out of ${count} device${count === 1 ? "" : "s"}`,
  });
  revalidatePath(`/admin/customers/${customerId}`);
}
