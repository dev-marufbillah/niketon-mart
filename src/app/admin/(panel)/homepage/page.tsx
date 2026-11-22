import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { SectionOrderList } from "@/components/admin/section-order-list";
import { requirePermission } from "@/lib/auth/session";
import { getHomepage } from "@/lib/repositories/homepage";
import { sectionSchemas } from "@/lib/content/section-schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Homepage" };

export default async function AdminHomepagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("content.view");
  const homepage = await getHomepage();
  const params = await searchParams;
  void params;

  const ordered = [...homepage.sections].sort((a, b) => a.order - b.order);

  return (
    <div>
      <AdminPageHeader
        title="Homepage"
        description="Reorder, hide and rewrite every section of the homepage. The storefront renders exactly this order."
        action={{ href: "/", label: "Preview homepage" }}
      />

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <h2 className="text-[14px] font-extrabold text-ink-900">Sections</h2>
          <p className="mb-3 mt-0.5 text-[11.5px] leading-relaxed text-ink-400">
            Use the arrows to change the order. Switch a section off to hide it from shoppers without deleting its
            content.
          </p>
          <SectionOrderList sections={ordered} />
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <h2 className="text-[14px] font-extrabold text-ink-900">Section copy</h2>
          <p className="mb-3 mt-0.5 text-[11.5px] leading-relaxed text-ink-400">
            Edit titles, buttons, images and product lists for each block.
          </p>
          <ul className="divide-y divide-line">
            {ordered.map((section) => {
              const schema = sectionSchemas[section.key];
              return (
                <li key={section.key} className="py-2">
                  <Link
                    href={`/admin/homepage/${section.key}`}
                    className="flex items-center justify-between gap-2 text-[12.5px] font-semibold text-ink-800 hover:text-brand-700"
                  >
                    <span>
                      {schema?.label ?? section.key}
                      {!section.visible ? <span className="ml-2 text-[10.5px] font-bold text-ink-300">HIDDEN</span> : null}
                    </span>
                    <span className="text-ink-300">→</span>
                  </Link>
                  {schema?.relatedModule ? (
                    <p className="mt-0.5 text-[11px] text-ink-400">
                      Content lives in{" "}
                      <Link href={schema.relatedModule.href} className="font-semibold text-brand-700">
                        {schema.relatedModule.label}
                      </Link>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
