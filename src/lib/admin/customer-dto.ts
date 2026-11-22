import type { Customer } from "@/lib/repositories/customers";

/** Only these fields are needed by the customer edit form. Database rows share
 * a collection with credentials, so never serialize a raw row to a Client
 * Component, even when its static TypeScript type is just `Customer`. */
export type AdminCustomerFormData = Pick<Customer, "id" | "name" | "phone" | "address" | "area" | "status" | "notes">;
export function toAdminCustomerFormData(customer: Customer): AdminCustomerFormData {
  return {
    id: customer.id, name: customer.name, phone: customer.phone,
    address: customer.address, area: customer.area, status: customer.status,
    notes: customer.notes,
  };
}
