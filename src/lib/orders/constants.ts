/**
 * Order vocabulary shared by server code and client forms.
 * Kept free of server-only imports so the admin UI can render the same statuses
 * and tones the API validates against.
 */

export type OrderChannel = "grocery" | "basket";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "refunded";

export type PaymentStatus =
  | "unpaid"
  | "awaiting_verification"
  | "paid"
  | "refunded"
  | "failed";

export const orderStatuses: { value: OrderStatus; label: string; tone: string }[] = [
  { value: "pending", label: "Pending", tone: "bg-accent-100 text-accent-700" },
  { value: "confirmed", label: "Confirmed", tone: "bg-brand-50 text-brand-700" },
  { value: "processing", label: "Processing", tone: "bg-brand-50 text-brand-700" },
  { value: "out_for_delivery", label: "Out for delivery", tone: "bg-brand-100 text-brand-800" },
  { value: "delivered", label: "Delivered", tone: "bg-brand-600 text-white" },
  { value: "cancelled", label: "Cancelled", tone: "bg-red-50 text-red-600" },
  { value: "refunded", label: "Refunded", tone: "bg-red-50 text-red-600" },
];

export const paymentStatuses: { value: PaymentStatus; label: string; help?: string }[] = [
  { value: "unpaid", label: "Unpaid", help: "Nothing collected yet — cash or card on delivery." },
  {
    value: "awaiting_verification",
    label: "Awaiting verification",
    help: "The customer says they sent a transfer; check the transaction ID before marking it paid.",
  },
  { value: "paid", label: "Paid" },
  { value: "refunded", label: "Refunded" },
  { value: "failed", label: "Failed", help: "The payment attempt was declined or abandoned." },
];

export const channelLabels: Record<OrderChannel, string> = {
  grocery: "Grocery",
  basket: "Daily basket",
};

export const movementReasonLabels: Record<string, string> = {
  "admin-adjustment": "Manual adjustment",
  "admin-edit": "Edited in product form",
  restock: "Restock from supplier",
  damaged: "Damaged / expired",
  returned: "Customer return",
  "initial-stock": "Opening stock",
  "order-placed": "Order placed",
  "order-cancelled": "Order cancelled",
  "product-created": "Product created",
  "product-deleted": "Product deleted",
};
