"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2, Star } from "lucide-react";
import { submitReviewAction, type ReviewFormState } from "@/lib/actions/reviews";
import type { PublicReview, ReviewSummary } from "@/lib/reviews/model";

/**
 * Reviews tab
 * -----------
 * Rating summary + star breakdown + approved review list + a submission form.
 * Approved reviews are rendered on the server and passed in; after a submission
 * the router refreshes so the list and the summary come straight from the
 * database rather than from client state.
 */

const PAGE_SIZE = 4;

function relativeDate(iso: string) {
  const date = new Date(iso).getTime();
  if (Number.isNaN(date)) return "";
  const days = Math.max(0, Math.round((Date.now() - date) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function Stars({ value, size = 15 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          size={size}
          strokeWidth={1.5}
          className={index < Math.round(value) ? "fill-star text-star" : "fill-ink-200 text-ink-200"}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function StarInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= (hover || value);
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <Star
              size={22}
              strokeWidth={1.5}
              className={active ? "fill-star text-star" : "fill-ink-100 text-ink-300"}
            />
          </button>
        );
      })}
      <span className="ml-2 text-[12px] font-semibold text-ink-500">{value ? `${value} / 5` : "Not rated"}</span>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-600 px-6 text-[13px] font-semibold text-white shadow-cta transition-colors hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? <Loader2 size={15} className="animate-spin" /> : null}
      {pending ? "Sending…" : "Submit"}
    </button>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[13px] text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none";

export function ReviewSection({
  productId,
  productName,
  reviews,
  summary,
  defaultName,
  defaultEmail,
}: {
  productId: string;
  productName: string;
  reviews: PublicReview[];
  summary: ReviewSummary;
  /** Prefilled for a signed-in shopper; every field stays editable. */
  defaultName?: string;
  defaultEmail?: string;
}) {
  const router = useRouter();
  const [state, action] = useActionState<ReviewFormState, FormData>(
    submitReviewAction.bind(null, productId),
    null,
  );
  const [rating, setRating] = useState(0);
  const [ratingError, setRatingError] = useState("");
  const [sort, setSort] = useState<"newest" | "highest" | "lowest">("newest");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const formRef = useRef<HTMLDivElement | null>(null);
  const lastSuccess = useRef<string | null>(null);

  // A new approval changes the list; refresh from the server instead of
  // mutating local state.
  useEffect(() => {
    if (state?.success && state.success !== lastSuccess.current) {
      lastSuccess.current = state.success;
      router.refresh();
    }
  }, [state, router]);

  const sorted = useMemo(() => {
    const copy = [...reviews];
    if (sort === "highest") copy.sort((a, b) => b.rating - a.rating || (a.createdAt < b.createdAt ? 1 : -1));
    else if (sort === "lowest") copy.sort((a, b) => a.rating - b.rating || (a.createdAt < b.createdAt ? 1 : -1));
    else copy.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return copy;
  }, [reviews, sort]);

  const shown = sorted.slice(0, visible);
  const percentages = summary.distribution.map((count) =>
    summary.total ? Math.round((count / summary.total) * 100) : 0,
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-10">
      {/* Summary + form */}
      <div className="space-y-6">
        <div className="rounded-2xl bg-surface-2 p-5">
          <p className="text-[13px] font-semibold text-ink-500">Customer rating</p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-[42px] font-extrabold leading-none text-ink-900 tabular-nums">
              {summary.average.toFixed(1)}
            </span>
            <span className="pb-1 text-[13px] text-ink-500">out of 5</span>
          </div>
          <div className="mt-1.5">
            <Stars value={summary.average} size={17} />
          </div>
          <p className="mt-1.5 text-[12.5px] text-ink-400">
            ({summary.total} Review{summary.total === 1 ? "" : "s"})
          </p>

          <ul className="mt-4 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const percent = percentages[star - 1];
              return (
                <li key={star} className="flex items-center gap-2 text-[11.5px] text-ink-500">
                  <span className="w-10 shrink-0">{star} Star</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-white ring-1 ring-line">
                    <span
                      className="block h-full rounded-full bg-accent-500"
                      style={{ width: `${percent}%` }}
                    />
                  </span>
                  <span className="w-9 shrink-0 text-right tabular-nums">{percent}%</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div ref={formRef} id="review-form" className="scroll-mt-24 rounded-2xl bg-white p-5 ring-1 ring-line">
          <h3 className="text-[15px] font-extrabold text-ink-900">Add your review</h3>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-400">
            Your email address will not be published. Sign in to verify a delivered purchase;
            other reviews are checked before they appear.
          </p>

          <form
            action={action}
            onSubmit={(event) => {
              if (!rating) {
                event.preventDefault();
                setRatingError("Choose a star rating before submitting.");
              }
            }}
            className="mt-4 space-y-3.5"
          >
            <input type="hidden" name="rating" value={rating} />

            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-ink-700">
                Name <span className="text-accent-600">*</span>
              </span>
              <input
                name="name"
                required
                autoComplete="name"
                placeholder="Your name"
                defaultValue={defaultName}
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-ink-700">
                Email <span className="text-accent-600">*</span>
              </span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                defaultValue={defaultEmail}
                className={inputClass}
              />
            </label>

            <div>
              <span className="mb-1 block text-[12px] font-semibold text-ink-700">
                Your rating <span className="text-accent-600">*</span>
              </span>
              <StarInput
                value={rating}
                onChange={(value) => {
                  setRating(value);
                  setRatingError("");
                }}
              />
              {ratingError ? (
                <p className="mt-1 text-[11.5px] font-medium text-red-600">{ratingError}</p>
              ) : null}
            </div>

            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-ink-700">
                Review title <span className="text-accent-600">*</span>
              </span>
              <input name="title" required placeholder="Sum it up in a few words" className={inputClass} />
            </label>

            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-ink-700">
                Detailed review <span className="text-accent-600">*</span>
              </span>
              <textarea
                name="body"
                required
                rows={4}
                placeholder={`What did you think of ${productName}?`}
                className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
              />
            </label>

            {state?.errors?.length ? (
              <ul role="alert" className="list-disc rounded-xl bg-red-50 px-5 py-2.5 text-[12px] text-red-600">
                {state.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            ) : null}
            {state?.success ? (
              <p role="status" className="rounded-xl bg-brand-50 px-3 py-2.5 text-[12px] font-semibold leading-relaxed text-brand-700">
                {state.success}
              </p>
            ) : null}

            <SubmitButton />
          </form>
        </div>
      </div>

      {/* List */}
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[15px] font-extrabold text-ink-900">Review list</h3>
          <label className="inline-flex items-center gap-2 text-[12px] text-ink-500">
            Sort by
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
              aria-label="Sort reviews"
              className="h-9 rounded-full border border-line bg-white px-3 text-[12px] font-semibold text-ink-700 focus:border-brand-500 focus:outline-none"
            >
              <option value="newest">Newest</option>
              <option value="highest">Highest rating</option>
              <option value="lowest">Lowest rating</option>
            </select>
          </label>
        </div>

        <p className="mb-4 text-[12px] text-ink-400">
          Showing {shown.length} of {sorted.length} review{sorted.length === 1 ? "" : "s"}
          {summary.total !== sorted.length ? " · rejected reviews are hidden" : ""}
        </p>

        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface-2 px-6 py-12 text-center">
            <p className="text-[14px] font-bold text-ink-800">No reviews yet</p>
            <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-ink-500">
              Be the first to review {productName}. Ordered it before? Your review will be marked as a
              verified purchase.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {shown.map((review) => (
              <li key={review.id} className="rounded-2xl bg-white p-4 ring-1 ring-line">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[13px] font-extrabold text-brand-700"
                  >
                    {review.name
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-[13px] font-bold text-ink-900">{review.name}</p>
                      {review.verifiedPurchase ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                          <BadgeCheck size={11} /> Verified purchase
                        </span>
                      ) : null}
                      <span className="ml-auto text-[11.5px] text-ink-400">{relativeDate(review.createdAt)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Stars value={review.rating} size={13} />
                      <span className="text-[11.5px] font-semibold text-ink-500">{review.rating.toFixed(1)}</span>
                    </div>
                    <p className="mt-2 text-[13px] font-bold text-ink-900">{review.title}</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink-600">{review.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {visible < sorted.length ? (
          <button
            type="button"
            onClick={() => setVisible((value) => value + PAGE_SIZE)}
            className="mt-4 inline-flex h-10 items-center rounded-full border border-line bg-white px-5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:border-brand-500 hover:text-brand-700"
          >
            Load more reviews ({sorted.length - visible} left)
          </button>
        ) : null}
      </div>
    </div>
  );
}
