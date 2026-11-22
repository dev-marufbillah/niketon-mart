"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { adjustStockAction, type AdminFormState } from "@/lib/admin/operations-actions";
import { movementReasonLabels } from "@/lib/orders/constants";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand-600 px-4 text-[12.5px] font-bold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Apply stock change"}
    </button>
  );
}

export function StockAdjustForm({
  products,
}: {
  products: { id: string; name: string; stock: number; unit: string }[];
}) {
  const [state, action] = useActionState<AdminFormState, FormData>(adjustStockAction, null);
  const [productId, setProductId] = useState("");
  const [expectedStock, setExpectedStock] = useState<number | undefined>();
  const [type, setType] = useState<"delta" | "absolute">("delta");
  const selected = useMemo(() => products.find((product) => product.id === productId), [products, productId]);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="expectedStock" value={expectedStock ?? ""} />
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-bold text-[#4e6858]">Product</span>
        <select
          name="productId"
          value={productId}
          onChange={(event) => {
            const id = event.target.value;
            setProductId(id);
            setExpectedStock(products.find((product) => product.id === id)?.stock);
          }}
          className="h-10 w-full rounded-xl border border-[#dce8df] bg-[#fbfdfb] px-3 text-[12.5px] outline-none focus:border-brand-500"
        >
          <option value="">Choose a product…</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} — {product.stock} in stock
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-bold text-[#4e6858]">Change type</span>
          <select
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value as "delta" | "absolute")}
            className="h-10 w-full rounded-xl border border-[#dce8df] bg-[#fbfdfb] px-3 text-[12.5px] outline-none focus:border-brand-500"
          >
            <option value="delta">Add / remove units</option>
            <option value="absolute">Set exact stock level</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-bold text-[#4e6858]">
            {type === "delta" ? "Units (+/−)" : "New stock level"}
          </span>
          <input
            name="value"
            type="number"
            step="1"
            placeholder={type === "delta" ? "e.g. 24 or -3" : "e.g. 40"}
            className="h-10 w-full rounded-xl border border-[#dce8df] bg-[#fbfdfb] px-3 text-[12.5px] outline-none focus:border-brand-500"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-[12px] font-bold text-[#4e6858]">Reason</span>
        <select name="reason" className="h-10 w-full rounded-xl border border-[#dce8df] bg-[#fbfdfb] px-3 text-[12.5px] outline-none focus:border-brand-500">
          {["admin-adjustment", "restock", "damaged", "returned", "initial-stock"].map((reason) => (
            <option key={reason} value={reason}>
              {movementReasonLabels[reason] ?? reason}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[12px] font-bold text-[#4e6858]">Note (optional)</span>
        <input
          name="note"
          placeholder="e.g. Weekly delivery from supplier"
          className="h-10 w-full rounded-xl border border-[#dce8df] bg-[#fbfdfb] px-3 text-[12.5px] outline-none focus:border-brand-500"
        />
      </label>

      {selected ? (
        <p className="rounded-xl bg-[#f0f7f2] px-3 py-2.5 text-[11.5px] leading-relaxed text-[#5d7868]">
          Stock when selected: <strong className="text-ink-800">{expectedStock}</strong> {selected.unit}. Refresh if it has changed.
        </p>
      ) : null}

      {state?.errors?.length ? (
        <ul role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-600">
          {state.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      {state?.success ? (
        <p role="status" className="rounded-xl bg-brand-50 px-3 py-2 text-[12px] font-semibold text-brand-700">
          {state.success}
        </p>
      ) : null}

      <Submit />
    </form>
  );
}
