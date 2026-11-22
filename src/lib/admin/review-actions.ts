"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/session";
import { logActivity } from "@/lib/repositories/activity";
import {
  deleteReview,
  setReviewReported,
  setReviewStatus,
} from "@/lib/reviews/repository";
import type { ReviewStatus } from "@/lib/reviews/model";

/**
 * Review moderation actions.
 * Permission-checked, logged and revalidated so the storefront rating summary
 * and the admin list always reflect the same database state.
 */

function refresh() {
  revalidatePath("/admin/reviews");
  revalidatePath("/admin");
  revalidatePath("/home-grocery");
  revalidatePath("/");
}

export async function moderateReviewAction(formData: FormData): Promise<void> {
  const user = await assertPermission("content.manage");
  const id = String(formData.get("reviewId") ?? "");
  const status = String(formData.get("status") ?? "") as ReviewStatus;
  if (!["approved", "pending", "rejected"].includes(status)) {
    throw new Error("Choose a valid review status.");
  }

  const review = await setReviewStatus(id, status, user.name);
  if (!review) throw new Error("That review no longer exists.");

  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "review",
    entity: "reviews",
    entityId: id,
    summary: `${status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Returned to pending"} review by ${review.name} on “${review.productName}”.`,
  });
  refresh();
}

export async function flagReviewAction(formData: FormData): Promise<void> {
  const user = await assertPermission("content.manage");
  const id = String(formData.get("reviewId") ?? "");
  const reported = String(formData.get("reported") ?? "") === "true";
  const reason = String(formData.get("reason") ?? "");

  const review = await setReviewReported(id, reported, reason);
  if (!review) throw new Error("That review no longer exists.");

  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "review",
    entity: "reviews",
    entityId: id,
    summary: `${reported ? "Flagged" : "Cleared flag on"} review by ${review.name} on “${review.productName}”.`,
  });
  refresh();
}

export async function deleteReviewAction(formData: FormData): Promise<void> {
  const user = await assertPermission("content.manage");
  const id = String(formData.get("reviewId") ?? "");
  const label = String(formData.get("label") ?? "review");

  const removed = await deleteReview(id);
  if (!removed) throw new Error("That review no longer exists.");

  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "delete",
    entity: "reviews",
    entityId: id,
    summary: `Deleted ${label}.`,
  });
  refresh();
}
