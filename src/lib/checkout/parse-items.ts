import type { QuoteInput } from "@/lib/checkout/quote";

/** Parse the untrusted cart payload without accepting any client-supplied price. */
export function parseCartItems(value: unknown):
  | { ok: true; items: QuoteInput["items"] }
  | { ok: false; error: string } {
  if (!Array.isArray(value) || value.length > 60) {
    return { ok: false, error: "Your basket is invalid or contains too many items." };
  }
  const items: QuoteInput["items"] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") return { ok: false, error: "An item in your basket is invalid." };
    const row = candidate as Record<string, unknown>;
    if (typeof row.productId !== "string" || !row.productId.trim() || row.productId.length > 120 ||
        typeof row.quantity !== "number" || !Number.isSafeInteger(row.quantity) || row.quantity < 1 || row.quantity > 1000 ||
        (row.variantLabel != null && (typeof row.variantLabel !== "string" || row.variantLabel.length > 100))) {
      return { ok: false, error: "An item in your basket has an invalid product, quantity or variant." };
    }
    let preparation: QuoteInput["items"][number]["preparation"];
    if (row.preparation != null) {
      if (typeof row.preparation !== "object" || Array.isArray(row.preparation)) return { ok: false, error: "Preparation selection is invalid." };
      const prep = row.preparation as Record<string, unknown>;
      if (!Array.isArray(prep.choices) || prep.choices.length > 12 ||
          (prep.instructions != null && (typeof prep.instructions !== "string" || prep.instructions.length > 300))) {
        return { ok: false, error: "Preparation choices or instructions are too long." };
      }
      const choices: { group: string; label: string }[] = [];
      for (const value of prep.choices) {
        if (!value || typeof value !== "object") return { ok: false, error: "Preparation selection is invalid." };
        const choice = value as Record<string, unknown>;
        if (typeof choice.group !== "string" || !choice.group.trim() || choice.group.length > 60 ||
            typeof choice.label !== "string" || !choice.label.trim() || choice.label.length > 80) {
          return { ok: false, error: "Preparation selection is invalid." };
        }
        choices.push({ group: choice.group, label: choice.label });
      }
      preparation = { choices, instructions: prep.instructions as string | undefined };
    }
    items.push({ productId: row.productId, quantity: row.quantity, variantLabel: row.variantLabel as string | undefined, preparation });
  }
  return { ok: true, items };
}
