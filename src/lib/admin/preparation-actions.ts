"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/session";
import { logActivity } from "@/lib/repositories/activity";
import {
  deletePreset,
  savePreset,
  type PresetInput,
  type PreparationPreset,
} from "@/lib/preparation/repository";

/**
 * Preparation management actions.
 *
 * Every mutation is permission-checked (`products.manage`), validated in the
 * repository and written to the activity log. Storefront routes are revalidated
 * so a change to a preset or a product's cutting options is visible immediately.
 */

function refresh() {
  revalidatePath("/admin/preparation");
  revalidatePath("/admin/catalogue/products");
  revalidatePath("/shop");
  revalidatePath("/home-grocery");
}

export async function savePresetAction(
  input: PresetInput,
): Promise<{ ok: true; data: PreparationPreset } | { ok: false; errors: string[] }> {
  const user = await assertPermission("products.manage");
  const result = await savePreset(input);
  if (!result.ok) return result;

  await logActivity({
    actor: { id: user.id, name: user.name },
    action: input.id ? "update" : "create",
    entity: "preparation_presets",
    entityId: result.data.id,
    summary: `${input.id ? "Updated" : "Created"} preparation preset “${result.data.name}”`,
  });
  refresh();
  return result;
}

export async function deletePresetAction(
  id: string,
): Promise<{ ok: true; message: string } | { ok: false; errors: string[] }> {
  const user = await assertPermission("products.manage");
  const result = await deletePreset(id);
  if (!result.ok) return result;

  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "delete",
    entity: "preparation_presets",
    entityId: id,
    summary: result.message,
  });
  refresh();
  return result;
}
