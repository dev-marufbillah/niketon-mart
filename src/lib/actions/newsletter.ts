"use server";

import { addSubscriber } from "@/lib/repositories/marketing";

export type SubscribeState = { error?: string; success?: string } | null;

/** Public newsletter signup — stored in the `subscribers` collection. */
export async function subscribeAction(
  _state: SubscribeState,
  formData: FormData,
): Promise<SubscribeState> {
  const email = String(formData.get("email") ?? "");
  const source = String(formData.get("source") ?? "homepage");
  const result = await addSubscriber(email, source);
  if (!result.ok) return { error: result.error };
  return { success: result.message };
}
