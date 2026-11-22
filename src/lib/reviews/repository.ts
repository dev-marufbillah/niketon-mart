import "server-only";

import { revalidatePath } from "next/cache";
import { ensureDatabase } from "@/lib/db";
import { makeId } from "@/lib/db/types";
import type { Product } from "@/lib/types/domain";
import type { Order } from "@/lib/repositories/orders";
import {
  summariseReviews,
  type Review,
  type PublicReview,
  type ReviewStatus,
  type ReviewSummary,
} from "@/lib/reviews/model";

/**
 * Product reviews
 * ---------------
 * Reviews live in their own collection, always tied to a product id. The
 * storefront only ever reads `approved` rows; everything else waits for an
 * administrator in /admin/reviews.
 *
 * Verified purchases require a signed-in customer session and a delivered
 * order belonging to that account. A supplied email alone is never proof.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type CreateReviewInput = {
  productId: string;
  name: string;
  email: string;
  rating: number;
  title: string;
  body: string;
  /** Resolved by the server from the customer session, never a form field. */
  reviewerId?: string;
};

export type CreateReviewResult =
  | { ok: true; review: Review; verified: boolean; message: string }
  | { ok: false; errors: string[] };

export async function listReviews(filter: { status?: ReviewStatus; productId?: string } = {}) {
  const db = await ensureDatabase();
  const rows = await db.list<Review>("reviews");
  return rows
    .filter((review) => (filter.status ? review.status === filter.status : true))
    .filter((review) => (filter.productId ? review.productId === filter.productId : true))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getApprovedReviews(productId: string): Promise<PublicReview[]> {
  const reviews = await listReviews({ productId, status: "approved" });
  return reviews.filter((review) => !review.isDemo).map((review) => ({
    id: review.id, name: review.name, rating: review.rating, title: review.title, body: review.body,
    verifiedPurchase: review.verifiedPurchase && review.verificationMethod === "account-session",
    createdAt: review.createdAt,
  }));
}

export async function getReviewSummary(productId: string): Promise<ReviewSummary> {
  return summariseReviews(await getApprovedReviews(productId));
}

async function isVerifiedPurchase(customerId: string | undefined, productId: string) {
  if (!customerId) return { verified: false as const };
  const db = await ensureDatabase();
  const orders = await db.list<Order>("orders");
  const match = orders.find((order) => order.customerWasAuthenticated === true && order.customerId === customerId && order.status === "delivered" &&
    order.items?.some((item) => item.productId === productId));
  return match ? { verified: true as const, orderNumber: match.number } : { verified: false as const };
}

/**
 * Keeps the product's star rating in sync with the reviews it actually has.
 * Products with no genuine approved reviews have a zero rating and count.
 */
export async function syncProductRating(productId: string) {
  const db = await ensureDatabase();
  const reviews = await getApprovedReviews(productId);
  const summary = summariseReviews(reviews);
  await db.update("products", productId, {
    rating: summary.average,
    reviewCount: summary.total,
  });
  const product = await db.get<Product>("products", productId);
  if (product) {
    revalidatePath(`/product/${product.slug}`);
    revalidatePath("/home-grocery");
    revalidatePath("/");
  }
}

export async function createReview(input: CreateReviewInput): Promise<CreateReviewResult> {
  const db = await ensureDatabase();
  const errors: string[] = [];

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const title = input.title.trim();
  const body = input.body.trim();
  const rating = Math.round(Number(input.rating));

  if (name.length < 2) errors.push("Enter your name so other shoppers know who wrote the review.");
  if (!EMAIL.test(email)) errors.push("Enter a valid email address.");
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) errors.push("Choose a star rating from 1 to 5.");
  if (title.length < 3) errors.push("Add a short review title (at least 3 characters).");
  if (body.length < 10) errors.push("Tell us a little more — at least 10 characters.");
  if (body.length > 1500) errors.push("Keep the review under 1500 characters.");
  if (errors.length) return { ok: false, errors };

  const product = await db.get<Product>("products", input.productId);
  if (!product) return { ok: false, errors: ["That product is no longer available."] };

  const existing = (await db.list<Review>("reviews", { where: { productId: product.id } })).find(
    (review) => review.email === email && review.status !== "rejected",
  );
  if (existing) {
    return {
      ok: false,
      errors: ["You have already reviewed this product. Contact us if you need to change it."],
    };
  }

  const verification = await isVerifiedPurchase(input.reviewerId, product.id);
  const now = new Date().toISOString();

  const review = await db.insert<Review>("reviews", {
    id: makeId("rev"),
    productId: product.id,
    productName: product.name,
    name,
    email,
    rating,
    title,
    body,
    // Verified purchases are trusted and appear immediately; everything else
    // waits for a human so the storefront cannot be spammed.
    status: verification.verified ? "approved" : "pending",
    verifiedPurchase: verification.verified,
    verificationMethod: verification.verified ? "account-session" : undefined,
    orderNumber: verification.verified ? verification.orderNumber : undefined,
    reported: false,
    createdAt: now,
    updatedAt: now,
  });

  if (verification.verified) await syncProductRating(product.id);
  revalidatePath(`/product/${product.slug}`);
  revalidatePath("/admin/reviews");

  return {
    ok: true,
    review,
    verified: verification.verified,
    message: verification.verified
      ? "Thanks! Your verified-purchase review is live."
      : "Thanks! Your review is waiting for a quick check before it appears.",
  };
}

export async function setReviewStatus(
  id: string,
  status: ReviewStatus,
  actor: string,
): Promise<Review | null> {
  const db = await ensureDatabase();
  const review = await db.get<Review>("reviews", id);
  if (!review) return null;
  const updated = await db.update<Review>("reviews", id, {
    status,
    moderatedBy: actor,
    moderatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await syncProductRating(review.productId);
  revalidatePath("/admin/reviews");
  return updated;
}

export async function setReviewReported(
  id: string,
  reported: boolean,
  reason = "",
): Promise<Review | null> {
  const db = await ensureDatabase();
  const updated = await db.update<Review>("reviews", id, {
    reported,
    reportReason: reported ? reason.trim() || "Flagged by staff" : "",
    updatedAt: new Date().toISOString(),
  });
  revalidatePath("/admin/reviews");
  return updated;
}

export async function deleteReview(id: string): Promise<boolean> {
  const db = await ensureDatabase();
  const review = await db.get<Review>("reviews", id);
  if (!review) return false;
  await db.remove("reviews", id);
  await syncProductRating(review.productId);
  revalidatePath("/admin/reviews");
  return true;
}

export async function getReviewOverview() {
  const reviews = await listReviews();
  const counts = {
    all: reviews.length,
    pending: reviews.filter((review) => review.status === "pending").length,
    approved: reviews.filter((review) => review.status === "approved").length,
    rejected: reviews.filter((review) => review.status === "rejected").length,
    reported: reviews.filter((review) => review.reported).length,
    verified: reviews.filter((review) => review.verifiedPurchase).length,
  };
  const rated = reviews.filter((review) => review.status === "approved");
  return {
    reviews,
    counts,
    average: summariseReviews(rated).average,
  };
}
