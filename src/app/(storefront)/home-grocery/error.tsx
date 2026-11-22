"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

/** Route-level error boundary for the shop (catalogue read / render failures). */
export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[home-grocery] failed to render", error);
  }, [error]);

  return (
    <section className="container-page py-20">
      <div className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-line bg-white px-6 py-14 text-center shadow-card">
        <span className="mb-4 inline-flex size-14 items-center justify-center rounded-full bg-accent-50 text-accent-700">
          <TriangleAlert size={24} />
        </span>
        <h1 className="text-[22px] font-extrabold text-ink-900">The shop couldn’t load</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">
          Something went wrong while loading the catalogue. Your cart is safe — try again, or head
          back to the homepage.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset} iconLeft={<RefreshCw size={15} />}>
            Try again
          </Button>
          <ButtonLink href="/" variant="outline">
            Go to homepage
          </ButtonLink>
        </div>
        {error.digest && (
          <p className="mt-5 text-[11.5px] uppercase tracking-wider text-ink-300">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </section>
  );
}
