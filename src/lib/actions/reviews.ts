"use server";

import { getCustomerSession } from "@/lib/auth/customer";
import { createReview } from "@/lib/reviews/repository";

export type ReviewFormState =
  | { errors?: string[]; success?: string; verified?: boolean }
  | null;

/**
 * Public review submission from the product page.
 * Every rule (rating range, duplicate prevention, verified purchase) is
 * enforced on the server — the browser only supplies the text.
 */
export async function submitReviewAction(
  productId: string,
  _state: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const session = await getCustomerSession();
  if (!session) return { errors: ["Please sign in or create an account to submit a review."] };
  const result = await createReview({
    reviewerId: session.id,
    productId,
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    rating: Number(formData.get("rating") ?? 0),
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
  });

  if (!result.ok) return { errors: result.errors };
  return { success: result.message, verified: result.verified };
}
