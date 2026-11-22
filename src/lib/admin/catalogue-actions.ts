"use server";

import { revalidatePath } from "next/cache";
import {
  deleteBrand,
  deleteCategory,
  deleteProduct,
  deleteProductType,
  moveCategory,
  saveBrand,
  saveCategory,
  saveProduct,
  saveProductType,
  updateProductField,
} from "@/lib/catalogue/repository";
import type { MutationResult, ProductInput } from "@/lib/catalogue/types";
import { assertPermission } from "@/lib/auth/session";
import { logActivity } from "@/lib/repositories/activity";

/**
 * Catalogue admin actions.
 *
 * The admin UI never talks to storage directly — every mutation is validated
 * server-side (prices, stock, slugs, taxonomy references), permission-checked,
 * written to the activity log and then revalidates the storefront routes.
 */

function refreshAdmin() {
  revalidatePath("/admin/catalogue/products");
  revalidatePath("/admin/catalogue/taxonomy");
  revalidatePath("/admin");
}

async function actor() {
  const user = await assertPermission("products.manage");
  return { id: user.id, name: user.name };
}

export async function saveProductAction(input: ProductInput) {
  const user = await actor();
  const result = await saveProduct(input, user.name);
  if (result.ok) {
    refreshAdmin();
    await logActivity({
      actor: user,
      action: "save",
      entity: "products",
      entityId: result.data.id,
      summary: `${input.id ? "Updated" : "Created"} product “${result.data.name}”`,
    });
  }
  return result;
}

export async function updateProductStockAction(id: string, stock: number, expectedStock: number) {
  const user = await actor();
  const result = await updateProductField(id, { stock }, user.name, expectedStock);
  if (result.ok) {
    refreshAdmin();
    await logActivity({ actor: user, action: "stock", entity: "products", entityId: id, summary: `Set stock of “${result.data.name}” to ${stock}` });
  }
  return result;
}

export async function toggleProductVisibilityAction(id: string, visible: boolean) {
  const user = await actor();
  const result = await updateProductField(id, { visibility: visible ? "visible" : "hidden" }, user.name);
  if (result.ok) {
    refreshAdmin();
    await logActivity({ actor: user, action: "visibility", entity: "products", entityId: id, summary: `${visible ? "Showed" : "Hid"} “${result.data.name}” on the storefront` });
  }
  return result;
}

export async function toggleProductStatusAction(id: string, active: boolean) {
  const user = await actor();
  const result = await updateProductField(id, { status: active ? "active" : "draft" }, user.name);
  if (result.ok) refreshAdmin();
  return result;
}

export async function toggleFeaturedAction(id: string, featured: boolean) {
  const user = await actor();
  const result = await updateProductField(id, { flags: { featured } }, user.name);
  if (result.ok) refreshAdmin();
  return result;
}

export async function deleteProductAction(id: string): Promise<MutationResult<{ id: string }>> {
  const user = await actor();
  const result = await deleteProduct(id, user.name);
  if (result.ok) {
    refreshAdmin();
    await logActivity({ actor: user, action: "delete", entity: "products", entityId: id, summary: result.message ?? "Deleted product" });
  }
  return result;
}

export async function saveCategoryAction(input: {
  id?: string;
  name: string;
  slug: string;
  icon: string;
  visible: boolean;
  group?: "fresh" | "pantry" | "household" | "bakery";
  parentId?: string;
  description?: string;
  image?: string;
  showOnHome?: boolean;
  showInNavigation?: boolean;
  showInPrimaryNavigation?: boolean;
  familyFiltersOnly?: boolean;
}) {
  const user = await actor();
  const result = await saveCategory(input);
  if (result.ok) {
    refreshAdmin();
    await logActivity({ actor: user, action: "save", entity: "categories", entityId: result.data.id, summary: `${input.id ? "Updated" : "Created"} category “${result.data.name}”` });
  }
  return result;
}

export async function moveCategoryAction(id: string, direction: "up" | "down") {
  const user = await actor();
  const result = await moveCategory(id, direction);
  if (result.ok) {
    refreshAdmin();
    await logActivity({ actor: user, action: "order", entity: "categories", entityId: id, summary: `Moved category ${direction}` });
  }
  return result;
}

export async function saveBrandAction(input: { id?: string; name: string; slug: string; visible: boolean }) {
  const user = await actor();
  const result = await saveBrand(input);
  if (result.ok) {
    refreshAdmin();
    await logActivity({ actor: user, action: "save", entity: "brands", entityId: result.data.id, summary: `${input.id ? "Updated" : "Created"} brand “${result.data.name}”` });
  }
  return result;
}

export async function saveProductTypeAction(input: { id?: string; name: string; slug: string; visible: boolean }) {
  const user = await actor();
  const result = await saveProductType(input);
  if (result.ok) {
    refreshAdmin();
    await logActivity({ actor: user, action: "save", entity: "product_types", entityId: result.data.id, summary: `${input.id ? "Updated" : "Created"} product type “${result.data.name}”` });
  }
  return result;
}

export async function deleteCategoryAction(id: string): Promise<MutationResult<{ id: string }>> {
  const user = await actor();
  const result = await deleteCategory(id);
  if (result.ok) {
    refreshAdmin();
    await logActivity({ actor: user, action: "delete", entity: "categories", entityId: id, summary: result.message ?? "Deleted category" });
  }
  return result;
}

export async function deleteBrandAction(id: string): Promise<MutationResult<{ id: string }>> {
  const user = await actor();
  const result = await deleteBrand(id);
  if (result.ok) { refreshAdmin(); await logActivity({ actor: user, action: "delete", entity: "brands", entityId: id, summary: result.message ?? "Deleted brand" }); }
  return result;
}

export async function deleteProductTypeAction(id: string): Promise<MutationResult<{ id: string }>> {
  const user = await actor();
  const result = await deleteProductType(id);
  if (result.ok) { refreshAdmin(); await logActivity({ actor: user, action: "delete", entity: "product_types", entityId: id, summary: result.message ?? "Deleted product type" }); }
  return result;
}

/** Delete a category, brand or product type by kind (used by the taxonomy screen). */
export async function deleteTaxonomyAction(
  kind: "category" | "brand" | "productType",
  id: string,
): Promise<MutationResult<{ id: string }>> {
  const user = await actor();
  const result =
    kind === "category"
      ? await deleteCategory(id)
      : kind === "brand"
        ? await deleteBrand(id)
        : await deleteProductType(id);
  if (result.ok) {
    refreshAdmin();
    await logActivity({
      actor: user,
      action: "delete",
      entity: kind === "category" ? "categories" : kind === "brand" ? "brands" : "product_types",
      entityId: id,
      summary: result.message ?? `Deleted ${kind}`,
    });
  }
  return result;
}
