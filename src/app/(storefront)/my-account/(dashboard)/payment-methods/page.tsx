import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";
import { AccountShell } from "@/components/account/account-shell";
import { PaymentMethodPicker } from "@/components/account/payment-method-picker";
import { getCustomerProfile } from "@/lib/auth/customer";
import { getAvailableCheckoutMethods } from "@/lib/repositories/operations";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payment method", robots: { index: false, follow: false } };

/**
 * Payment Method.
 * The list is the store's live, admin-managed payment configuration — the same
 * records checkout offers. Nothing card-shaped is stored server-side, and the
 * page says so instead of showing fake saved cards.
 */
export default async function PaymentMethodsPage() {
  const [profile, methods] = await Promise.all([getCustomerProfile(), getAvailableCheckoutMethods()]);
  const current = methods.some((method) => method.id === profile?.defaultPaymentMethodId)
    ? (profile?.defaultPaymentMethodId as string)
    : (methods[0]?.id ?? "");

  return (
    <AccountShell
      next="/my-account/payment-methods"
      title="Payment Method"
      description="Choose the method you normally pay with — checkout will preselect it for you."
    >
      <PaymentMethodPicker
        methods={methods.map((method) => ({
          id: method.id,
          label: method.label,
          description: method.description,
          type: method.type,
          instructions: method.instructions,
        }))}
        current={current}
      />

      <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-line">
        <p className="flex items-center gap-1.5 text-[12.5px] font-extrabold text-ink-900">
          <Info size={14} className="text-brand-600" /> About saving cards
        </p>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-500">
          This store does not keep card numbers, CVVs or mobile-wallet PINs — not in encrypted form, not at all. Card
          payments are completed on the provider&apos;s own page when a payment gateway is connected, and cash is collected
          on delivery. Because no card-vault provider is connected yet, saving a card here would be a promise the store
          cannot keep, so the option is intentionally absent rather than decorative.
        </p>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-400">
          Payment options are managed by the store in Admin → Payment methods. Looking for an earlier payment?{" "}
          <Link href="/my-account/orders" className="font-semibold text-brand-700">
            Open your orders
          </Link>
          .
        </p>
      </div>
    </AccountShell>
  );
}
