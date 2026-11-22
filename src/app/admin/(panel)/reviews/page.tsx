import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Flag, Star } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { can } from "@/lib/auth/permissions";
import { requireAdmin } from "@/lib/auth/session";
import { getReviewOverview } from "@/lib/reviews/repository";
import { reviewStatuses, type Review, type ReviewStatus } from "@/lib/reviews/model";
import { deleteReviewAction, flagReviewAction, moderateReviewAction } from "@/lib/admin/review-actions";
import { formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reviews",
  description: "Moderate customer reviews and keep product ratings honest.",
};

const filters: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "reported", label: "Reported" },
];

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          size={12}
          strokeWidth={1.5}
          className={index < Math.round(value) ? "fill-star text-star" : "fill-ink-200 text-ink-200"}
        />
      ))}
    </span>
  );
}

function ReviewCard({ review, canManage }: { review: Review; canManage: boolean }) {
  const status = reviewStatuses.find((entry) => entry.value === review.status);
  const nextStatus: ReviewStatus | null =
    review.status === "approved" ? "pending" : "approved";

  return (
    <li className="rounded-2xl bg-white p-4 ring-1 ring-line">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[13px] font-bold text-ink-900">
            {review.name}
            {review.verifiedPurchase ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                <BadgeCheck size={10} /> Verified
              </span>
            ) : null}
            {review.reported ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">
                <Flag size={10} /> Reported
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[11.5px] text-ink-400">
            {review.email} · {formatDate(review.createdAt)} ·{" "}
            <Link
              href={`/admin/catalogue/products/${review.productId}`}
              className="font-semibold text-brand-700"
            >
              {review.productName}
            </Link>
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${status?.tone ?? ""}`}>
          {status?.label ?? review.status}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Stars value={review.rating} />
        <span className="text-[11.5px] font-semibold text-ink-500">{review.rating.toFixed(1)}</span>
      </div>
      <p className="mt-1.5 text-[12.5px] font-bold text-ink-900">{review.title}</p>
      <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-600">{review.body}</p>
      {review.reportReason ? (
        <p className="mt-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11.5px] text-red-600">
          Flag reason: {review.reportReason}
        </p>
      ) : null}

      {canManage ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <form action={moderateReviewAction}>
            <input type="hidden" name="reviewId" value={review.id} />
            <input type="hidden" name="status" value={nextStatus ?? "pending"} />
            <button
              type="submit"
              className={`inline-flex h-8 items-center rounded-full px-3 text-[11.5px] font-semibold ${
                nextStatus === "approved"
                  ? "bg-brand-600 text-white hover:bg-brand-700"
                  : "bg-surface text-ink-700 hover:bg-ink-900/5"
              }`}
            >
              {nextStatus === "approved" ? "Approve" : "Unpublish"}
            </button>
          </form>
          {review.status !== "rejected" ? (
            <form action={moderateReviewAction}>
              <input type="hidden" name="reviewId" value={review.id} />
              <input type="hidden" name="status" value="rejected" />
              <button
                type="submit"
                className="inline-flex h-8 items-center rounded-full bg-surface px-3 text-[11.5px] font-semibold text-ink-700 hover:bg-red-50 hover:text-red-600"
              >
                Reject
              </button>
            </form>
          ) : null}
          <form action={flagReviewAction}>
            <input type="hidden" name="reviewId" value={review.id} />
            <input type="hidden" name="reported" value={review.reported ? "false" : "true"} />
            <input type="hidden" name="reason" value={review.reported ? "" : "Flagged by staff"} />
            <button
              type="submit"
              className="inline-flex h-8 items-center gap-1 rounded-full bg-surface px-3 text-[11.5px] font-semibold text-ink-700 hover:bg-accent-50 hover:text-accent-700"
            >
              <Flag size={11} />
              {review.reported ? "Clear flag" : "Flag"}
            </button>
          </form>
          <form action={deleteReviewAction}>
            <input type="hidden" name="reviewId" value={review.id} />
            <input
              type="hidden"
              name="label"
              value={`review by ${review.name} on “${review.productName}”`}
            />
            <button
              type="submit"
              className="inline-flex h-8 items-center rounded-full px-3 text-[11.5px] font-semibold text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </form>
        </div>
      ) : null}
    </li>
  );
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireAdmin();

  if (!can(user, "content.view")) {
    return (
      <div className="rounded-2xl bg-white p-6 ring-1 ring-line">
        <h1 className="text-[18px] font-extrabold text-ink-900">You do not have access</h1>
        <p className="mt-1.5 text-[13px] text-ink-500">Reviews are managed by the content team.</p>
      </div>
    );
  }

  const canManage = can(user, "content.manage");
  const { reviews, counts, average } = await getReviewOverview();
  const active = typeof params.status === "string" ? params.status : "";
  const search = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";

  let visible = reviews;
  if (active === "reported") visible = visible.filter((review) => review.reported);
  else if (active) visible = visible.filter((review) => review.status === active);
  if (search) {
    visible = visible.filter((review) =>
      [review.name, review.productName, review.title, review.body, review.email]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Reviews"
        description="Approve, reject or flag customer reviews. Approved reviews appear on the product page and drive the product's star rating."
        meta={`${counts.all} reviews · ${counts.approved} live · ${counts.pending} waiting · average ${average.toFixed(1)} / 5`}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Awaiting moderation", value: counts.pending, tone: counts.pending > 0 ? "text-accent-600" : "" },
          { label: "Published", value: counts.approved, tone: "text-brand-700" },
          { label: "Reported", value: counts.reported, tone: counts.reported > 0 ? "text-red-600" : "" },
          { label: "Verified purchases", value: counts.verified, tone: "" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl bg-white p-4 ring-1 ring-line">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              {card.label}
            </span>
            <p className={`mt-1.5 text-[22px] font-extrabold leading-none tabular-nums ${card.tone || "text-ink-900"}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter reviews" className="flex flex-wrap gap-1.5">
          {filters.map((filter) => {
            const isActive = active === filter.value;
            const query = new URLSearchParams();
            if (filter.value) query.set("status", filter.value);
            if (search) query.set("q", search);
            return (
              <Link
                key={filter.value || "all"}
                href={`/admin/reviews${query.toString() ? `?${query}` : ""}`}
                aria-current={isActive}
                className={`inline-flex h-8 items-center rounded-full px-3.5 text-[12px] font-semibold transition-colors ${
                  isActive ? "bg-brand-600 text-white" : "bg-white text-ink-600 ring-1 ring-line hover:text-brand-700"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </nav>

        <form action="/admin/reviews" className="flex items-center gap-2">
          {active ? <input type="hidden" name="status" value={active} /> : null}
          <input
            name="q"
            defaultValue={search}
            placeholder="Search name, product or text"
            aria-label="Search reviews"
            className="h-9 w-56 rounded-full border border-line bg-white px-3.5 text-[12px] focus:border-brand-500 focus:outline-none"
          />
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-full bg-surface px-3.5 text-[12px] font-semibold text-ink-700 hover:bg-ink-900/5"
          >
            Search
          </button>
        </form>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-line">
          <p className="text-[14px] font-bold text-ink-800">No reviews in this view</p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-ink-500">
            New reviews arrive from the product page. Verified purchases are published immediately; others wait
            here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((review) => (
            <ReviewCard key={review.id} review={review} canManage={canManage} />
          ))}
        </ul>
      )}
    </div>
  );
}
