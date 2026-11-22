import type { Product } from "@/lib/types/domain";

/**
 * Additional Information tab.
 * Every row comes from the product's `details` record and is rendered only when
 * it has a value — a bag of apples never shows "Ingredients" or "Dimensions".
 */

type Row = { label: string; value: string };

function rowsFor(product: Product): Row[] {
  const details = product.details ?? {};
  const rows: Row[] = [];

  for (const attribute of details.specifications ?? []) {
    if (!attribute.label || !attribute.value) continue;
    // "Category" and "Product Type" are the same fact — show it once.
    if (
      attribute.label.toLowerCase() === "category" &&
      (details.specifications ?? []).some(
        (entry) => entry.label.toLowerCase() === "product type" && entry.value === attribute.value,
      )
    ) {
      continue;
    }
    rows.push({ label: attribute.label, value: attribute.value });
  }
  // When a product is sold by weight variations, the selected size already shows
  // above the tabs — a second static "Weight" row would only confuse.
  const hasOptions = (product.options ?? []).some((group) => group.values.length > 0);
  if (!hasOptions && (details.weight || product.unit)) {
    rows.push({ label: "Weight", value: details.weight || product.unit });
  }
  if (details.dimensions) rows.push({ label: "Dimensions", value: details.dimensions });
  if (details.storage) rows.push({ label: "Storage instructions", value: details.storage });
  if (details.usage) rows.push({ label: "Usage instructions", value: details.usage });
  if (details.ingredients) rows.push({ label: "Ingredients", value: details.ingredients });

  // Older products kept their specs in `attributes` — keep showing them, unless
  // the same fact is already covered by the additional-information record.
  const covered = (label: string) => {
    const needle = label.toLowerCase().replace(/\s*instructions?$/, "").trim();
    return rows.some((row) => {
      const existing = row.label.toLowerCase().replace(/\s*instructions?$/, "").trim();
      return existing === needle || existing.includes(needle) || needle.includes(existing);
    });
  };
  for (const attribute of product.attributes ?? []) {
    if (!attribute.label || !attribute.value) continue;
    if (covered(attribute.label)) continue;
    rows.push({ label: attribute.label, value: attribute.value });
  }

  return rows;
}

function InfoTable({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-line">
      <table className="w-full text-left">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr className="bg-accent-500 text-[12.5px] font-bold uppercase tracking-[0.06em] text-brand-900">
            <th scope="col" className="w-[38%] px-4 py-2.5 font-bold sm:w-[30%]">
              Attribute
            </th>
            <th scope="col" className="px-4 py-2.5 font-bold">
              Details
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.label}-${index}`}
              className={index % 2 === 0 ? "bg-white" : "bg-surface-2"}
            >
              <th scope="row" className="px-4 py-2.5 text-[12.5px] font-semibold text-ink-700">
                {row.label}
              </th>
              <td className="px-4 py-2.5 text-[12.5px] text-ink-600">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdditionalInformation({ product }: { product: Product }) {
  const rows = rowsFor(product);
  const nutrition = (product.details?.nutrition ?? []).filter((row) => row.label && row.value);

  if (rows.length === 0 && nutrition.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface-2 px-6 py-12 text-center">
        <p className="text-[14px] font-bold text-ink-800">No additional information yet</p>
        <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-ink-500">
          Specifications for this product have not been added. Our team can help with any detail you need —
          use the contact page and we will answer within one working day.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {rows.length > 0 ? <InfoTable title={`${product.name} specifications`} rows={rows} /> : null}

      {nutrition.length > 0 ? (
        <div>
          <h3 className="mb-2 text-[13px] font-extrabold uppercase tracking-[0.08em] text-ink-500">
            Nutritional information
          </h3>
          <InfoTable title={`${product.name} nutrition`} rows={nutrition} />
          <p className="mt-2 text-[11.5px] text-ink-400">
            Values are typical per serving and provided by the supplier.
          </p>
        </div>
      ) : null}
    </div>
  );
}
