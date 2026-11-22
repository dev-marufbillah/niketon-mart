/**
 * Review model
 * ------------
 * Types, status labels and the pure helpers shared by the storefront review
 * form, the product page and the admin moderation screen. No database imports,
 * so client components can use it.
 */

export type ReviewStatus = "pending" | "approved" | "rejected";

export type Review = {
  id: string;
  productId: string;
  productName: string;
  name: string;
  email: string;
  rating: number;
  title: string;
  body: string;
  status: ReviewStatus;
  /** New verified reviews are backed by a delivered order owned by the signed-in account. */
  verifiedPurchase: boolean;
  /** Only account-session verified reviews may display a verified badge. */
  verificationMethod?: "account-session";
  orderNumber?: string;
  /** Customer- or staff-raised concern ("inappropriate language"). */
  reported: boolean;
  reportReason?: string;
  moderatedBy?: string;
  moderatedAt?: string;
  createdAt: string;
  updatedAt?: string;
  isDemo?: boolean;
};

/** Explicit fields safe to send to storefront client components. */
export type PublicReview = Pick<Review, "id" | "name" | "rating" | "title" | "body" | "verifiedPurchase" | "createdAt">;

export const reviewStatuses: { value: ReviewStatus; label: string; tone: string }[] = [
  { value: "pending", label: "Pending", tone: "bg-accent-100 text-accent-700" },
  { value: "approved", label: "Approved", tone: "bg-brand-50 text-brand-700" },
  { value: "rejected", label: "Rejected", tone: "bg-ink-100 text-ink-500" },
];

export const reviewStatusLabel = (status: string) =>
  reviewStatuses.find((entry) => entry.value === status)?.label ?? status;

export type ReviewSummary = {
  average: number;
  total: number;
  /** Count per star, index 0 = 1 star … index 4 = 5 stars. */
  distribution: [number, number, number, number, number];
};

/** Aggregates approved reviews for the rating summary and the star breakdown. */
export function summariseReviews(reviews: Pick<Review, "rating">[]): ReviewSummary {
  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let sum = 0;
  for (const review of reviews) {
    const rating = Math.min(5, Math.max(1, Math.round(review.rating)));
    distribution[rating - 1] += 1;
    sum += review.rating;
  }
  const total = reviews.length;
  const average = total ? Math.round((sum / total) * 10) / 10 : 0;
  return { average, total, distribution };
}
