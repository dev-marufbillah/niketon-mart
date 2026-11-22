"use server";

import { revalidatePath } from "next/cache";
import { saveTopPicksSection } from "@/lib/content/home-sections/repository";
import { assertPermission } from "@/lib/auth/session";
import { logActivity } from "@/lib/repositories/activity";

/** Save the Our Top Picks section (copy, link, ordered products). */
export async function saveTopPicksAction(input: unknown) {
  const user = await assertPermission("content.manage");
  const result = await saveTopPicksSection(input, { updatedBy: user.name });
  if (result.ok) {
    await logActivity({
      actor: { id: user.id, name: user.name },
      action: "save",
      entity: "homepage.topPicks",
      summary: "Updated the Our Top Picks section",
    });
    revalidatePath("/admin/home/our-top-picks");
  }
  return result;
}
