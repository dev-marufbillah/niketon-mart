import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ResourceTable } from "@/components/admin/resource-table";
import { getResource, resources } from "@/lib/admin/resources";
import { can, canView } from "@/lib/auth/permissions";
import { requireAdmin } from "@/lib/auth/session";
import { ensureDatabase } from "@/lib/db";
import type { Row } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ resource: string }>;
}): Promise<Metadata> {
  const { resource } = await params;
  const config = getResource(resource);
  return { title: config?.label ?? "Manage" };
}

export default async function ResourceListPage({
  params,
  searchParams,
}: {
  params: Promise<{ resource: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { resource } = await params;
  const query = await searchParams;
  const config = getResource(resource);
  if (!config) notFound();

  const user = await requireAdmin();
  const canManage = can(user, config.permission);
  const canRead = canView(user, config.permission);

  if (!canRead) {
    return (
      <div className="rounded-2xl bg-white p-6 ring-1 ring-line">
        <h1 className="text-[18px] font-extrabold text-ink-900">You do not have access</h1>
        <p className="mt-1.5 text-[13px] text-ink-500">
          Ask the store owner to grant your role access to {config.label.toLowerCase()}.
        </p>
        <Link href="/admin" className="mt-4 inline-block text-[12.5px] font-semibold text-brand-700">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const db = await ensureDatabase();
  let rows = (await db.list(config.collection)) as Row[];
  const search = typeof query.q === "string" ? query.q.trim().toLowerCase() : "";
  if (search) {
    rows = rows.filter((row) =>
      config.searchFields.some((field) => String(row[field] ?? "").toLowerCase().includes(search)),
    );
  }
  const filters = config.filters ?? [];
  const activeFilters = filters.filter((entry) => entry.value && query[entry.field] === entry.value);
  if (activeFilters.length) {
    rows = rows.filter((row) => activeFilters.every((entry) => String(row[entry.field] ?? "") === entry.value));
  }

  if (config.defaultSort) {
    const { field, direction } = config.defaultSort;
    rows = [...rows].sort((a, b) => {
      const left = String(a[field] ?? "");
      const right = String(b[field] ?? "");
      return direction === "asc" ? left.localeCompare(right) : right.localeCompare(left);
    });
  }

  const blocked = typeof query.blocked === "string" ? query.blocked : null;
  const notice =
    typeof query.created === "string"
      ? "Created successfully. Visibility depends on the record's settings."
      : typeof query.updated === "string"
        ? "Changes saved."
        : typeof query.deleted === "string"
          ? "Deleted."
          : null;

  return (
    <div>
      <AdminPageHeader
        title={config.label}
        description={config.description}
        action={
          canManage && config.canCreate !== false
            ? { href: `/admin/r/${config.key}/new`, label: `Add ${config.singular}` }
            : undefined
        }
      />

      {blocked ? (
        <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-amber-700">
          Not deleted — {blocked}
        </p>
      ) : null}

      {notice ? (
        <p role="status" className="mb-4 rounded-xl bg-brand-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-brand-700">
          {notice}
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <form action={`/admin/r/${config.key}`} className="flex w-full max-w-[400px] gap-2">
          {activeFilters.map((entry) => <input key={entry.field} type="hidden" name={entry.field} value={entry.value} />)}
          <span className="relative min-w-0 flex-1">
            <input name="q" defaultValue={search} placeholder={`Search ${config.label.toLowerCase()}…`} aria-label={`Search ${config.label}`} className="h-10 w-full rounded-xl border border-[#dfeae2] bg-white pl-9 pr-3 text-[12.5px] outline-none focus:border-brand-500" />
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg></span>
          </span>
          <button type="submit" className="h-10 rounded-xl bg-brand-600 px-4 text-[12px] font-bold text-white hover:bg-brand-700">Search</button>
        </form>
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((entry) => {
            const active = entry.value ? query[entry.field] === entry.value : activeFilters.length === 0;
            const href = entry.value
              ? `?${entry.field}=${encodeURIComponent(entry.value)}${search ? `&q=${encodeURIComponent(search)}` : ""}`
              : search
                ? `?q=${encodeURIComponent(search)}`
                : "/admin/r/" + config.key;
            return (
              <Link
                key={`${entry.field}-${entry.value || "all"}`}
                href={`/admin/r/${config.key}${href.startsWith("?") ? href : ""}`}
                className={`inline-flex items-center rounded-full px-3 py-1 text-[11.5px] font-semibold ${
                  active ? "bg-brand-600 text-white" : "bg-white text-ink-600 ring-1 ring-line hover:text-brand-700"
                }`}
              >
                {entry.label}
              </Link>
            );
          })}
        </div>
        <p className="text-[11.5px] text-ink-400">
          {rows.length} {rows.length === 1 ? config.singular : `${config.singular}s`}
          {search ? ` matching “${search}”` : ""} · stored in{" "}
          <code className="rounded bg-surface px-1.5 py-0.5">{config.collection}</code>
        </p>
      </div>

      <ResourceTable config={config} rows={rows} canManage={canManage} isFiltered={Boolean(search || activeFilters.length)} />

      {config.previewPath ? (
        <p className="mt-4 text-[11.5px] text-ink-400">
          Tip: open the website to check a record — hidden records never render.
        </p>
      ) : null}

      <nav aria-label="Related admin sections" className="mt-8 border-t border-line pt-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-300">All website content</p>
        <ul className="flex flex-wrap gap-1.5">
          {Object.values(resources).filter((entry) => canView(user, entry.permission)).map((entry) => (
            <li key={entry.key}>
              <Link
                href={`/admin/r/${entry.key}`}
                className={`inline-flex rounded-full px-3 py-1 text-[11.5px] font-semibold ${
                  entry.key === config.key
                    ? "bg-brand-600 text-white"
                    : "bg-white text-ink-600 ring-1 ring-line hover:text-brand-700"
                }`}
              >
                {entry.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
