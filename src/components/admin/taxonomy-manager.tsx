"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ImageUploader } from "@/components/admin/image-uploader";
import { CategoryImage } from "@/components/ui/category-image";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Loader2, Plus, Trash2, TriangleAlert } from "lucide-react";
import type { Brand, Category, ProductType } from "@/lib/types/domain";
import type { MutationResult, TaxonomyKind } from "@/lib/catalogue/types";
import { cn } from "@/lib/utils/cn";
import {
  deleteTaxonomyAction,
  moveCategoryAction,
  saveBrandAction,
  saveCategoryAction,
  saveProductTypeAction,
} from "@/lib/admin/catalogue-actions";

type Row = { id: string; name: string; slug: string; visible: boolean; icon?: string; group?: Category["group"]; parentId?: string; description?: string; image?: string; showOnHome?: boolean; showInNavigation?: boolean; showInPrimaryNavigation?: boolean; familyFiltersOnly?: boolean; usage: number };

function Panel({
  title,
  description,
  kind,
  rows,
  categoryChoices = [],
  onSave,
}: {
  title: string;
  description: string;
  kind: TaxonomyKind;
  rows: Row[];
  categoryChoices?: Category[];
  onSave: (input: {
    id?: string;
    name: string;
    slug: string;
    icon: string;
    visible: boolean;
    group?: Category["group"];
    parentId?: string;
    description?: string; image?: string; showOnHome?: boolean; showInNavigation?: boolean; showInPrimaryNavigation?: boolean; familyFiltersOnly?: boolean;
  }) => Promise<MutationResult<unknown>>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<Row | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [icon, setIcon] = useState("🛒");
  const [group, setGroup] = useState<NonNullable<Category["group"]>>("fresh");
  const [parentId, setParentId] = useState("");
  const [descriptionText, setDescriptionText] = useState("");
  const [image, setImage] = useState("");
  const [showOnHome, setShowOnHome] = useState(true);
  const [showInNavigation, setShowInNavigation] = useState(true);
  const [showInPrimaryNavigation, setShowInPrimaryNavigation] = useState(false);
  const [familyFiltersOnly, setFamilyFiltersOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const reset = () => {
    setEditing(null);
    setName("");
    setSlug("");
    setIcon("🛒");
    setGroup("fresh");
    setParentId("");
    setDescriptionText(""); setImage(""); setShowOnHome(true); setShowInNavigation(true); setShowInPrimaryNavigation(false); setFamilyFiltersOnly(false);
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (imageUploading) { setError("Wait for the image upload to finish before saving."); return; }
    setBusy(true);
    setError(null);
    try {
      const result = await onSave({
        id: editing?.id,
        name: name || editing?.name || "",
        slug: slug || editing?.slug || "",
        icon,
        group,
        parentId,
        ...(kind === "category" ? { description: descriptionText, image, showOnHome, showInNavigation, showInPrimaryNavigation, familyFiltersOnly } : {}),
        visible: editing?.visible ?? true,
      });
      if (!result.ok) { setError(result.errors.join(" ")); return; }
      reset();
      startTransition(() => router.refresh());
    } catch {
      setError("Could not confirm the save. Check your connection and refresh before retrying.");
    } finally {
      setBusy(false);
    }
  };

  const toggleVisible = async (row: Row) => {
    setBusy(true);
    setError(null);
    try {
      const result = await onSave({
        id: row.id,
        name: row.name,
        slug: row.slug,
        icon: row.icon ?? "🛒",
        group: row.group,
        parentId: row.parentId ?? "",
        visible: !row.visible,
      });
      if (!result.ok) setError(result.errors.join(" "));
      else startTransition(() => router.refresh());
    } catch {
      setError("Could not confirm the update. Check your connection and refresh before retrying.");
    } finally {
      setBusy(false);
    }
  };

  const move = async (row: Row, direction: "up" | "down") => {
    setBusy(true);
    setError(null);
    try {
      const result = await moveCategoryAction(row.id, direction);
      if (!result.ok) setError(result.errors.join(" "));
      else startTransition(() => router.refresh());
    } catch {
      setError("Could not confirm the update. Check your connection and refresh before retrying.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: Row) => {
    setBusy(true);
    setError(null);
    try {
      const result = await deleteTaxonomyAction(kind, row.id);
      setConfirmDelete(null);
      if (!result.ok) setError(result.errors.join(" "));
      else startTransition(() => router.refresh());
    } catch {
      setError("Could not confirm the deletion. Check your connection and refresh before retrying.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-extrabold text-ink-900">{title}</h2>
        <span className="rounded-full bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-ink-500">
          {rows.length}
        </span>
      </div>
      <p className="mb-4 text-[12px] leading-relaxed text-ink-500">{description}</p>

      <ul className="mb-4 divide-y divide-line">
        {rows.map((row, index) => (
          <li key={row.id} className="flex items-center gap-2 py-2">
            {kind === "category" && <CategoryImage src={row.image} size={32} className="size-8 rounded-lg bg-surface" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-ink-800">
                {row.name}
                {!row.visible && (
                  <span className="ml-1.5 rounded bg-surface px-1.5 py-0.5 text-[10.5px] font-bold uppercase text-ink-400">
                    hidden
                  </span>
                )}
                {kind === "category" && row.showInPrimaryNavigation && (
                  <span className="ml-1.5 rounded bg-brand-50 px-1.5 py-0.5 text-[10.5px] font-bold text-brand-700">Primary nav</span>
                )}
              </span>
              <span className="block truncate text-[11px] text-ink-400">
                {row.parentId ? `${categoryChoices.find((category) => category.id === row.parentId)?.name ?? "Missing parent"} › ` : ""}/{row.slug} · {row.usage} product{row.usage === 1 ? "" : "s"}
              </span>
            </span>

            {kind === "category" && (
              <span className="flex shrink-0 flex-col">
                <button type="button" disabled={busy || imageUploading || index === 0} onClick={() => move(row, "up")} aria-label={`Move ${row.name} up`} className="p-1 text-ink-500 disabled:opacity-25"><ArrowUp size={13} /></button>
                <button type="button" disabled={busy || imageUploading || index === rows.length - 1} onClick={() => move(row, "down")} aria-label={`Move ${row.name} down`} className="p-1 text-ink-500 disabled:opacity-25"><ArrowDown size={13} /></button>
              </span>
            )}
            <button
              type="button"
              disabled={busy || imageUploading}
              onClick={() => toggleVisible(row)}
              aria-label={`${row.visible ? "Hide" : "Show"} ${row.name}`}
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-full transition-colors",
                row.visible
                  ? "bg-brand-50 text-brand-700 hover:bg-brand-100"
                  : "bg-surface text-ink-400 hover:bg-ink-900/5",
              )}
            >
              {row.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>

            <button
              type="button"
              disabled={busy || imageUploading}
              onClick={() => {
                setEditing(row);
                setName(row.name);
                setSlug(row.slug);
                setIcon(row.icon ?? "🛒");
                setGroup(row.group ?? "fresh");
                setParentId(row.parentId ?? "");
                setDescriptionText(row.description ?? ""); setImage(row.image ?? "");
                setShowOnHome(row.showOnHome ?? true); setShowInNavigation(row.showInNavigation ?? true);
                setShowInPrimaryNavigation(row.showInPrimaryNavigation ?? false);
                setFamilyFiltersOnly(row.familyFiltersOnly === true || row.showInPrimaryNavigation === true);
              }}
              className="inline-flex h-8 items-center rounded-full bg-surface px-2.5 text-[11.5px] font-semibold text-ink-600 hover:bg-brand-50 hover:text-brand-700"
            >
              Edit
            </button>

            {confirmDelete === row.id ? (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={busy || imageUploading}
                  onClick={() => remove(row)}
                  className="inline-flex h-8 items-center rounded-full bg-red-600 px-2.5 text-[11px] font-bold text-white"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className="inline-flex h-8 items-center rounded-full bg-surface px-2.5 text-[11px] font-semibold text-ink-600"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                type="button"
                disabled={busy || imageUploading}
                onClick={() => setConfirmDelete(row.id)}
                aria-label={`Delete ${row.name}`}
                className="inline-flex size-8 items-center justify-center rounded-full bg-surface text-ink-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="space-y-2.5 rounded-xl bg-surface-2 p-3">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-bold text-ink-700">
            {editing ? `Editing “${editing.name}”` : `Add ${title.toLowerCase()}`}
          </p>
          {editing && (
            <button
              type="button"
              disabled={busy || imageUploading}
              onClick={reset}
              className="text-[11.5px] font-semibold text-ink-500 underline underline-offset-2 disabled:opacity-40"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            aria-label={`New ${kind} name`}
            className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-white px-2.5 text-[12.5px] focus:border-brand-500 focus:outline-none"
          />
        </div>

        {kind === "category" && (
          <label className="block text-[11px] font-semibold text-ink-600">
            Parent category (optional)
            <select value={parentId} onChange={(event) => setParentId(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-line bg-white px-2 text-[12px]">
              <option value="">Top-level category</option>
              {categoryChoices.filter((category) => !category.parentId && category.id !== editing?.id).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
        )}
        {kind === "category" && !parentId && (
          <label className="block text-[11px] font-semibold text-ink-600">
            Navigation group
            <select value={group} onChange={(event) => setGroup(event.target.value as NonNullable<Category["group"]>)} className="mt-1 h-9 w-full rounded-lg border border-line bg-white px-2 text-[12px]">
              <option value="fresh">Fresh Market</option>
              <option value="pantry">Grocery & Essentials</option>
              <option value="household">Household</option>
              <option value="bakery">Bakery</option>
            </select>
            <span className="mt-1 block font-normal text-ink-400">Fresh Market appears on the Fresh Market page. The other groups appear on Grocery. Subcategories follow their parent.</span>
          </label>
        )}
        {kind === "category" ? <div className="space-y-3">
          <label className="block text-[11px] font-semibold text-ink-600">Description
            <textarea value={descriptionText} onChange={(event) => setDescriptionText(event.target.value)} maxLength={500} rows={2} className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1 text-xs" />
          </label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={showOnHome} onChange={(event) => setShowOnHome(event.target.checked)} /> Show on homepage</label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={showInNavigation} onChange={(event) => setShowInNavigation(event.target.checked)} /> Show in category navigation</label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={showInPrimaryNavigation} onChange={(event) => { setShowInPrimaryNavigation(event.target.checked); if (event.target.checked) setFamilyFiltersOnly(true); }} /> Feature in primary navigation</label>
          <p className="text-[11px] leading-relaxed text-ink-400">One category can be featured in the top menu. Its link shows only that category and its children, with matching filters. Unfeature the current choice first to select another. Hidden categories or hidden parents will not appear; category navigation must be enabled.</p>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={familyFiltersOnly || showInPrimaryNavigation} disabled={showInPrimaryNavigation} onChange={(event) => setFamilyFiltersOnly(event.target.checked)} /> Show subcategories as filters only</label>
          <p className="text-[11px] leading-relaxed text-ink-400">Keeps this category family scoped and replaces illustrated subcategory cards with filters, even if it leaves the top menu. Featured categories always use filters. Other category families keep their existing cards unless selected.</p>
          {image ? <div className="flex items-center gap-2"><Image src={image} alt="Category image preview" width={54} height={54} className="size-14 rounded-lg object-cover" /><button type="button" disabled={busy || imageUploading} onClick={() => setImage("")} className="text-xs underline disabled:opacity-40">Remove image</button></div> : null}
          <ImageUploader folder="categories" multiple={false} compact disabled={busy} label="Upload category image" onBusyChange={setImageUploading} onUploaded={(urls) => setImage(urls[0] ?? image)} />
          <p className="text-[11px] leading-relaxed text-ink-400">This picture is used in category navigation, the Categories page and homepage. Without one, a visible product image or a neutral placeholder is shown. Save after uploading.</p>
        </div> : null}
        <div className="flex gap-2">
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="slug (auto)"
            aria-label={`New ${kind} slug`}
            className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-white px-2.5 text-[12.5px] focus:border-brand-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || imageUploading}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-600 px-3.5 text-[12px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy || imageUploading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            {imageUploading ? "Uploading…" : editing ? "Save" : "Add"}
          </button>
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-1.5 text-[11.5px] font-medium text-red-600">
            <TriangleAlert size={12} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}
        {!error && (
          <p className="flex items-center gap-1.5 text-[11px] text-ink-400">
            <Check size={11} /> New entries appear in the shop filters instantly.
          </p>
        )}
      </form>
    </section>
  );
}

export function TaxonomyManager({
  categories,
  brands,
  productTypes,
}: {
  categories: (Category & { productCount?: number })[];
  brands: Brand[];
  productTypes: ProductType[];
}) {
  const categoryRows: Row[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    icon: category.icon,
    group: category.group,
    parentId: category.parentId,
    description: category.description, image: category.image, showOnHome: category.showOnHome, showInNavigation: category.showInNavigation,
    showInPrimaryNavigation: category.showInPrimaryNavigation, familyFiltersOnly: category.familyFiltersOnly,
    visible: category.visible ?? true,
    usage: category.productCount ?? 0,
  }));

  const brandRows: Row[] = brands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    visible: brand.visible ?? true,
    usage: brand.productCount ?? 0,
  }));

  const typeRows: Row[] = productTypes.map((type) => ({
    id: type.id,
    name: type.name,
    slug: type.slug,
    visible: type.visible ?? true,
    usage: type.productCount ?? 0,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel
        title="Categories"
        description="Controls category tiles, navigation and shop filters. Use arrows to reorder; hidden categories and their products are not shown publicly."
        kind="category"
        rows={categoryRows}
        categoryChoices={categories}
        onSave={saveCategoryAction}
      />
      <Panel
        title="Brands"
        description="Drives the Brand filter. Usage counts are shown on the shop page."
        kind="brand"
        rows={brandRows}
        onSave={saveBrandAction}
      />
      <Panel
        title="Product types"
        description="Drives the Product Type filter (fresh, packaged, frozen…)."
        kind="productType"
        rows={typeRows}
        onSave={saveProductTypeAction}
      />
    </div>
  );
}
