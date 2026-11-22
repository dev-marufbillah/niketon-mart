"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Check, Loader2, Plus, Trash2, TriangleAlert } from "lucide-react";
import type { Brand, Category, Product, ProductPreparation, ProductType } from "@/lib/types/domain";
import type { PreparationPresetOption, ProductInput } from "@/lib/catalogue/types";
import { saveProductAction } from "@/lib/admin/catalogue-actions";
import { DetailsEditor, GalleryEditor, OptionsEditor } from "@/components/admin/product-details-editor";
import { ProductPreparationEditor } from "@/components/admin/preparation-editor";
import { CURRENCY_SYMBOL } from "@/lib/utils/currency";

const fieldClass =
  "h-10 w-full rounded-xl border border-line bg-white px-3 text-[13px] text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none";
const labelClass = "mb-1.5 block text-[12px] font-semibold text-ink-700";

/**
 * Labelled form control. Renders a real <label> so every input is addressable by
 * assistive tech (and by tests) — `htmlFor` is not used because the control is
 * passed as a child.
 */
function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11.5px] text-ink-400">{hint}</span>}
      {error && <span className="mt-1 block text-[11.5px] font-medium text-red-600">{error}</span>}
    </label>
  );
}

const gallery = [
  "/images/products/oranges.jpg",
  "/images/products/tomatoes.jpg",
  "/images/products/bananas.jpg",
  "/images/products/cabbage.jpg",
  "/images/products/blueberries.jpg",
  "/images/products/strawberry.jpg",
  "/images/products/cauliflower.jpg",
  "/images/products/broccoli.jpg",
  "/images/products/brown-bread.jpg",
];

export function ProductForm({
  product,
  categories,
  brands,
  productTypes,
  presets,
}: {
  product?: Product;
  categories: Category[];
  brands: Brand[];
  productTypes: ProductType[];
  /** Preparation library — the admin can start from a preset and then edit. */
  presets: PreparationPresetOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const [form, setForm] = useState<ProductInput>({
    id: product?.id,
    inventorySnapshot: product ? {
      stock: product.stock ?? 0,
      soldCount: product.soldCount ?? 0,
      options: (product.options ?? []).map((group) => ({ ...group, values: group.values.map((value) => ({ ...value })) })),
    } : undefined,
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    description: product?.description ?? "",
    categoryId: product?.categoryId ?? categories[0]?.id ?? "",
    brandId: product?.brandId ?? brands[0]?.id ?? "",
    productTypeId: product?.productTypeId ?? productTypes[0]?.id ?? "",
    image: product?.image ?? "",
    imageMode: product?.imageMode ?? "contain",
    unit: product?.unit ?? "500 g",
    price: product?.price ?? 0,
    compareAtPrice: product?.compareAtPrice ?? null,
    stock: product?.stock ?? 0,
    rating: product?.rating ?? 0,
    reviewCount: product?.reviewCount ?? 0,
    sku: product?.sku ?? "",
    status: product?.status ?? "active",
    visibility: product?.visibility ?? "visible",
    featured: Boolean(product?.flags?.featured),
    attributes: product?.attributes ?? [],
    images:
      product?.images && product.images.length > 0
        ? product.images
        : product?.image
          ? [product.image]
          : [],
    options: product?.options ?? [],
    details: product?.details ?? {},
    selling: product?.selling ?? {
      unit: product?.unit ?? "1 kg",
      minQuantity: 1,
      step: 1,
    },
    preparation: product?.preparation ?? { enabled: false, groups: [], allowInstructions: true, maxInstructionLength: 160 },
  });

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const selectedCategory = categories.find((category) => category.id === form.categoryId);
  const selectedParent = selectedCategory?.parentId
    ? categories.find((category) => category.id === selectedCategory.parentId)
    : undefined;
  const isFreshFish = selectedCategory?.slug === "fish" || selectedParent?.slug === "fish";

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors([]);
    setSaving(true);
    const result = await saveProductAction(form);
    setSaving(false);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    startTransition(() => {
      router.push("/admin/catalogue/products");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
          <h2 className="mb-4 text-[15px] font-extrabold text-ink-900">Product details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product name">
              <input
                required
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                className={fieldClass}
                placeholder="Fresh Oranges"
              />
            </Field>
            <Field label="URL slug" hint="Generated from the name if left blank.">
              <input
                value={form.slug}
                onChange={(event) => set("slug", event.target.value)}
                className={fieldClass}
                placeholder="fresh-oranges"
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Description" hint="Shown on the product page and in search.">
              <textarea
                required
                rows={3}
                value={form.description}
                onChange={(event) => set("description", event.target.value)}
                className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[13px] leading-relaxed text-ink-800 focus:border-brand-500 focus:outline-none"
                placeholder="Juicy, sun-ripened oranges…"
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Category / subcategory" hint="Choose a subcategory when one applies; its parent is shown first.">
              <select
                value={form.categoryId}
                onChange={(event) => set("categoryId", event.target.value)}
                className={fieldClass}
              >
                {!categories.length && <option value="">Create a category first</option>}
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.parentId ? `${categories.find((parent) => parent.id === category.parentId)?.name ?? "Missing parent"} › ` : ""}{category.name}{category.visible === false ? " (hidden)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Brand">
              <select
                value={form.brandId}
                onChange={(event) => set("brandId", event.target.value)}
                className={fieldClass}
              >
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Product type">
              <select
                value={form.productTypeId}
                onChange={(event) => set("productTypeId", event.target.value)}
                className={fieldClass}
              >
                {productTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
          <h2 className="mb-4 text-[15px] font-extrabold text-ink-900">Pricing & inventory</h2>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field
              label={`${isFreshFish ? "Current market price" : "Sale price"} (${CURRENCY_SYMBOL})`}
              hint={isFreshFish
                ? "Enter the verified BDT rate for this selling unit. If pricing per kg, set both unit fields to 1 kg. Update the rate manually; there is no automatic market-price feed."
                : undefined}
            >
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(event) => set("price", Number(event.target.value))}
                className={fieldClass}
              />
            </Field>
            <Field label={`Compare-at (${CURRENCY_SYMBOL})`} hint="Leave 0 for no discount.">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.compareAtPrice ?? 0}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  set("compareAtPrice", value > 0 ? value : null);
                }}
                className={fieldClass}
              />
            </Field>
            <Field label="Stock (units)">
              <input
                required
                type="number"
                min="0"
                value={form.stock}
                onChange={(event) => set("stock", Number(event.target.value))}
                className={fieldClass}
              />
            </Field>
            <Field label="Unit / weight">
              <input
                required
                value={form.unit}
                onChange={(event) => set("unit", event.target.value)}
                className={fieldClass}
                placeholder="500 g"
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="SKU">
              <input
                value={form.sku}
                onChange={(event) => set("sku", event.target.value)}
                className={fieldClass}
                placeholder="FRU-ORG-500"
              />
            </Field>
            <Field label="Rating (0–5)">
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={form.rating}
                onChange={(event) => set("rating", Number(event.target.value))}
                className={fieldClass}
              />
            </Field>
            <Field label="Review count">
              <input
                type="number"
                min="0"
                value={form.reviewCount}
                onChange={(event) => set("reviewCount", Number(event.target.value))}
                className={fieldClass}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
          <h2 className="mb-1 text-[15px] font-extrabold text-ink-900">Selling &amp; quantity</h2>
          <p className="mb-4 text-[11.5px] leading-relaxed text-ink-400">
            How this product is sold: by the kilo, half-kilo, piece or pack. The weight choices shoppers see
            come from <strong>Variations</strong> below — this section sets the default unit, the smallest
            quantity allowed and how the quantity steps up.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Selling unit" hint="Shown next to the price — “1 kg”, “500 g”, “piece”.">
              <input
                value={form.selling.unit ?? ""}
                onChange={(event) => set("selling", { ...form.selling, unit: event.target.value })}
                className={fieldClass}
                placeholder="1 kg"
              />
            </Field>
            <Field label="Minimum quantity" hint="Smallest amount a shopper can order.">
              <input
                type="number"
                min={1}
                value={form.selling.minQuantity ?? 1}
                onChange={(event) => set("selling", { ...form.selling, minQuantity: Number(event.target.value) })}
                className={fieldClass}
              />
            </Field>
            <Field label="Quantity step" hint="1 = whole units, 2 = pairs…">
              <input
                type="number"
                min={1}
                value={form.selling.step ?? 1}
                onChange={(event) => set("selling", { ...form.selling, step: Number(event.target.value) })}
                className={fieldClass}
              />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Estimated weight"
              hint="For pieces sold by weight — e.g. “800 g – 1.2 kg per fish”."
            >
              <input
                value={form.selling.estimatedWeight ?? ""}
                onChange={(event) =>
                  set("selling", { ...form.selling, estimatedWeight: event.target.value })
                }
                className={fieldClass}
                placeholder="1.2–1.4 kg per bird"
              />
            </Field>
            <Field
              label="Grams in one unit"
              hint="Used for the weighing step — “1 kg” = 1000, “500 g” = 500. Leave blank to read it from the unit label."
            >
              <input
                type="number"
                min={1}
                max={50000}
                value={form.selling.unitGrams ?? ""}
                onChange={(event) =>
                  set("selling", {
                    ...form.selling,
                    unitGrams: event.target.value === "" ? undefined : Number(event.target.value),
                  })
                }
                className={fieldClass}
                placeholder="1000"
              />
            </Field>
            <label className="flex items-end gap-2 pb-2 text-[12.5px] text-ink-700">
              <input
                type="checkbox"
                checked={Boolean(form.selling.variableWeight)}
                onChange={(event) => set("selling", { ...form.selling, variableWeight: event.target.checked })}
                className="size-4 rounded border-ink-300 accent-brand-600"
              />
              Final weight may differ slightly (show the weight note)
            </label>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
          <h2 className="mb-1 text-[15px] font-extrabold text-ink-900">Preparation &amp; cutting</h2>
          <p className="mb-4 text-[11.5px] leading-relaxed text-ink-400">
            Fish, meat, poultry and some vegetables can be cleaned and cut to order. These options appear on
            the product page, in the cart and on the order — the shopper&rsquo;s choice is stored with the order
            item so it never changes retroactively.
          </p>
          <ProductPreparationEditor
            value={form.preparation}
            presets={presets}
            onChange={(preparation) => set("preparation", preparation as ProductPreparation)}
          />
        </section>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
          <h2 className="mb-4 text-[15px] font-extrabold text-ink-900">Attributes</h2>
          <div className="space-y-2.5">
            {form.attributes.map((attribute, index) => (
              <div key={index} className="flex items-end gap-2">
                <div className="flex-1">
                  <Field label={index === 0 ? "Label" : ""}>
                    <input
                      aria-label={`Attribute ${index + 1} label`}
                      value={attribute.label}
                      onChange={(event) => {
                        const next = form.attributes.slice();
                        next[index] = { ...next[index], label: event.target.value };
                        set("attributes", next);
                      }}
                      className={fieldClass}
                      placeholder="Origin"
                    />
                  </Field>
                </div>
                <div className="flex-1">
                  <Field label={index === 0 ? "Value" : ""}>
                    <input
                      aria-label={`Attribute ${index + 1} value`}
                      value={attribute.value}
                      onChange={(event) => {
                        const next = form.attributes.slice();
                        next[index] = { ...next[index], value: event.target.value };
                        set("attributes", next);
                      }}
                      className={fieldClass}
                      placeholder="Valencia groves"
                    />
                  </Field>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "attributes",
                      form.attributes.filter((_, position) => position !== index),
                    )
                  }
                  aria-label="Remove attribute"
                  className="mb-0.5 inline-flex size-10 items-center justify-center rounded-xl bg-surface text-ink-500 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => set("attributes", [...form.attributes, { label: "", value: "" }])}
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-50 px-3.5 text-[12.5px] font-semibold text-brand-700 hover:bg-brand-100"
          >
            <Plus size={14} /> Add attribute
          </button>
        </section>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
          <h2 className="mb-1 text-[15px] font-extrabold text-ink-900">Gallery</h2>
          <GalleryEditor
            images={form.images}
            library={gallery}
            onChange={(images) => {
              set("images", images);
              set("image", images[0] ?? "");
            }}
          />
        </section>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
          <h2 className="mb-1 text-[15px] font-extrabold text-ink-900">Variations</h2>
          <OptionsEditor options={form.options} onChange={(options) => set("options", options)} />
        </section>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
          <h2 className="mb-1 text-[15px] font-extrabold text-ink-900">Additional information</h2>
          <DetailsEditor details={form.details} onChange={(details) => set("details", details)} />
        </section>
      </div>

      <aside className="min-w-0 space-y-5">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
          <h2 className="mb-3 text-[15px] font-extrabold text-ink-900">Publishing</h2>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(event) => set("status", event.target.value as ProductInput["status"])}
              className={fieldClass}
            >
              <option value="active">Published</option>
              <option value="draft">Draft</option>
            </select>
          </Field>
          <div className="mt-3">
            <Field label="Visibility">
              <select
                value={form.visibility}
                onChange={(event) =>
                  set("visibility", event.target.value as ProductInput["visibility"])
                }
                className={fieldClass}
              >
                <option value="visible">Visible on storefront</option>
                <option value="hidden">Hidden</option>
              </select>
            </Field>
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-ink-700">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(event) => set("featured", event.target.checked)}
              className="size-4 rounded border-ink-300 accent-brand-600"
            />
            Featured on the homepage rail
          </label>
        </section>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
          <h2 className="mb-3 text-[15px] font-extrabold text-ink-900">Image fit</h2>
          <Field label="How photos are framed">
            <select
              value={form.imageMode}
              onChange={(event) =>
                set("imageMode", event.target.value as ProductInput["imageMode"])
              }
              className={fieldClass}
            >
              <option value="contain">Contain (white packshot)</option>
              <option value="cover">Cover (full-bleed photo)</option>
            </select>
          </Field>
          <p className="mt-3 text-[11.5px] leading-relaxed text-ink-400">
            Gallery images, their order and the main image are managed in the Gallery section of the form.
          </p>
        </section>

        {errors.length > 0 && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[12.5px] text-red-700"
          >
            <p className="flex items-center gap-1.5 font-bold">
              <TriangleAlert size={14} /> Couldn’t save
            </p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving || pending}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-brand-600 px-5 text-[13.5px] font-semibold text-white shadow-cta transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            {saving || pending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Check size={15} />
            )}
            {product ? "Save changes" : "Create product"}
          </button>
          <Link
            href="/admin/catalogue/products"
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-surface px-4 text-[13px] font-semibold text-ink-700 hover:bg-ink-900/5"
          >
            <ArrowLeft size={14} /> Back
          </Link>
        </div>
      </aside>
    </form>
  );
}
