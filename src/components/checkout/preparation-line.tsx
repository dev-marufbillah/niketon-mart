import type { CartPreparation } from "@/lib/types/domain";
import type { OrderItemPreparation } from "@/lib/repositories/orders";

/**
 * The shopper's preparation choices, wherever an item is shown: cart, checkout,
 * confirmation, order history and the admin order screen. One component keeps
 * the wording identical everywhere.
 */
export function PreparationLine({
  preparation,
  tone = "default",
}: {
  preparation?: CartPreparation | OrderItemPreparation;
  tone?: "default" | "admin";
}) {
  if (!preparation || preparation.options.length === 0) return null;
  const notes = preparation.instructions?.trim();

  return (
    <div
      className={
        tone === "admin"
          ? "mt-1 rounded-lg bg-surface px-2 py-1 text-[11px] text-ink-600"
          : "mt-1 text-[11.5px] text-ink-500"
      }
    >
      <span className="font-semibold text-ink-700">Preparation: </span>
      {preparation.options.map((option, index) => (
        <span key={`${option.group}-${option.label}`}>
          {index > 0 ? " · " : ""}
          {option.label}
          {option.charge > 0 ? <span className="text-brand-700"> (+{option.charge})</span> : null}
        </span>
      ))}
      {notes ? <p className="mt-0.5 italic text-ink-500">“{notes}”</p> : null}
    </div>
  );
}
