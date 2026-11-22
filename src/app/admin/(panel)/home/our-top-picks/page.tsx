import { requirePermission } from "@/lib/auth/session";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { getResolvedTopPicksSection, getTopPicksRecord } from "@/lib/content/home-sections/repository";
import { getAdminCatalogue } from "@/lib/catalogue/repository";
import { topPicksLimits } from "@/lib/content/home-sections/defaults";
import type { AdminProductOption } from "@/components/admin/top-picks-editor";
import { TopPicksEditor } from "@/components/admin/top-picks-editor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Our Top Picks — Homepage",
  description: "Manage the Our Top Picks section content and products.",
};

export default async function OurTopPicksAdminPage() {
  await requirePermission("content.manage");
  const [record, resolved, adminCatalogue] = await Promise.all([
    getTopPicksRecord(),
    getResolvedTopPicksSection(),
    getAdminCatalogue(),
  ]);

  // The full catalogue is passed once; the editor filters/searches client-side.
  const catalogue: AdminProductOption[] = adminCatalogue.products
    .filter(() => true)
    .map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      category: product.categoryLabel,
      unit: product.unit,
      price: product.price,
      image: product.image,
      imageMode: product.imageMode,
      availability: product.availability,
    }));

  return (
    <div className="pb-16">
      <div className="rounded-2xl border border-[#e4ece6] bg-white">
        <div className="px-4 py-6 sm:px-5">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12.5px] text-ink-500">
            <Link href="/admin" className="transition-colors hover:text-brand-700">
              Admin
            </Link>
            <ChevronRight size={13} className="text-ink-300" />
            <span>Homepage</span>
            <ChevronRight size={13} className="text-ink-300" />
            <span className="font-semibold text-ink-800">Our Top Picks</span>
          </nav>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-[24px] leading-tight sm:text-[28px]">
                Our Top <span className="text-brand-600">Picks</span>
              </h1>
              <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-ink-500">
                Choose the products this homepage section shows, set their order and
                edit the heading copy. Changes go live on save.
              </p>
            </div>
            <Link
              href="/#our-top-picks"
              className="inline-flex h-10 w-fit items-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-brand-700 ring-1 ring-line transition-colors hover:bg-brand-50"
            >
              <ExternalLink size={14} /> View on homepage
            </Link>
          </div>
        </div>
      </div>

      <div className="pt-6">
        {resolved.missingProductIds.length > 0 && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-accent-300 bg-accent-50 px-4 py-3 text-[13px] text-ink-700"
          >
            <strong className="font-semibold">Heads up:</strong>{" "}
            {resolved.missingProductIds.length} product
            {resolved.missingProductIds.length > 1 ? "s" : ""} in this section no longer
            exist in the catalogue ({resolved.missingProductIds.join(", ")}). They are
            hidden on the homepage and will be removed on your next save.
          </div>
        )}

        <TopPicksEditor
          initial={{
            eyebrow: record.eyebrow,
            title: record.title,
            subtitle: record.subtitle,
            ctaLabel: record.ctaLabel,
            ctaHref: record.ctaHref,
            productIds: record.productIds,
            updatedAt: record.updatedAt,
            updatedBy: record.updatedBy,
          }}
          catalogue={catalogue}
          limits={topPicksLimits}
        />
      </div>
    </div>
  );
}
