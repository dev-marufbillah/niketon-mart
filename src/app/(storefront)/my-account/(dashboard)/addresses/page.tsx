import type { Metadata } from "next";
import { AccountShell } from "@/components/account/account-shell";
import { AddressManager } from "@/components/account/address-manager";
import { getCustomerProfile } from "@/lib/auth/customer";
import { listAddresses } from "@/lib/repositories/accounts";
import { getDeliveryAreas } from "@/lib/repositories/operations";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Manage address", robots: { index: false, follow: false } };

/**
 * Manage Address — the customer's own address book. The same rows are what the
 * checkout reads, so an edit here changes the next checkout immediately.
 */
export default async function ManageAddressPage() {
  const profile = await getCustomerProfile();
  const [addresses, areas] = await Promise.all([
    profile ? listAddresses(profile.id) : Promise.resolve([]),
    getDeliveryAreas(),
  ]);

  return (
    <AccountShell
      next="/my-account/addresses"
      title="Manage Address"
      description="Saved delivery and billing addresses. Checkout fills these in automatically."
    >
      <AddressManager
        addresses={addresses}
        areas={areas.map((area) => ({ id: area.id, name: area.name }))}
        defaults={{
          firstName: profile?.firstName ?? "",
          lastName: profile?.lastName ?? "",
          phone: profile?.phone ?? "",
          email: profile?.email ?? "",
        }}
      />
    </AccountShell>
  );
}
