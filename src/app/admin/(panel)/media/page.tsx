import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { MediaList, MediaUploader } from "@/components/admin/media-grid";
import { requirePermission } from "@/lib/auth/session";
import { getMediaFolders, listMedia } from "@/lib/repositories/media";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Media library" };

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("media.manage");
  const params = await searchParams;
  const folder = typeof params.folder === "string" ? params.folder : "";
  const [items, folders] = await Promise.all([listMedia(folder || undefined), getMediaFolders()]);

  return (
    <div>
      <AdminPageHeader
        title="Media library"
        description="Every image uploaded through the admin. Add alt text for accessibility and reuse files in any image field."
        meta={`${items.length} file${items.length === 1 ? "" : "s"}${folder ? ` in “${folder}”` : ""}`}
        action={undefined}
      />

      <div className="mb-4">
        <MediaUploader folders={folders} />
      </div>

      {folders.length > 0 ? (
        <ul className="mb-4 flex flex-wrap gap-1.5">
          <li>
            <Link
              href="/admin/media"
              className={`inline-flex rounded-full px-3 py-1 text-[11.5px] font-semibold ${
                folder ? "bg-white text-ink-600 ring-1 ring-line" : "bg-brand-600 text-white"
              }`}
            >
              All files
            </Link>
          </li>
          {folders.map((entry) => (
            <li key={entry}>
              <a
                href={`/admin/media?folder=${encodeURIComponent(entry)}`}
                className={`inline-flex rounded-full px-3 py-1 text-[11.5px] font-semibold capitalize ${
                  folder === entry ? "bg-brand-600 text-white" : "bg-white text-ink-600 ring-1 ring-line"
                }`}
              >
                {entry}
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {typeof params.deleted === "string" ? (
        <p role="status" className="mb-4 rounded-xl bg-brand-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-brand-700">
          File deleted.
        </p>
      ) : null}

      <MediaList items={items} />
    </div>
  );
}
