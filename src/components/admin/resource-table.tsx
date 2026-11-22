import Link from "next/link";
import type { ColumnDef } from "@/lib/admin/fields";
import type { ResourceConfig } from "@/lib/admin/resources";
import { OrderControls, RowMenu, VisibilityToggle } from "@/components/admin/resource-row-actions";
import { formatDate, formatPrice } from "@/lib/utils/format";

function CellValue({ column, value }: { column: ColumnDef; value: unknown }) {
  if (value === undefined || value === null || value === "") {
    return <span className="text-ink-300">—</span>;
  }

  switch (column.type) {
    case "image":
      return (
        <span className="inline-flex h-11 w-11 overflow-hidden rounded-lg bg-surface ring-1 ring-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={String(value)} alt="" className="size-full object-cover" />
        </span>
      );
    case "price":
      return <span className="tabular-nums">{formatPrice(Number(value))}</span>;
    case "number":
      return <span className="tabular-nums">{Number(value)}</span>;
    case "date":
      return <span className="text-[12px] text-ink-500">{formatDate(String(value))}</span>;
    case "boolean":
      return (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            value ? "bg-brand-50 text-brand-700" : "bg-surface text-ink-400"
          }`}
        >
          {value ? "Yes" : "No"}
        </span>
      );
    case "badge":
      return (
        <span className="inline-flex rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold capitalize text-ink-600">
          {String(value).replace(/_/g, " ")}
        </span>
      );
    default: {
      const text = String(value);
      return <span className="line-clamp-2">{text.length > 90 ? `${text.slice(0, 90)}…` : text}</span>;
    }
  }
}

export function ResourceTable({
  config,
  rows,
  canManage,
  isFiltered = false,
}: {
  config: ResourceConfig;
  rows: Record<string, unknown>[];
  canManage: boolean;
  isFiltered?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
        <p className="text-[15px] font-bold text-ink-800">{isFiltered ? "No records match this view" : "Nothing here yet"}</p>
        <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-ink-500">
          {isFiltered ? "Try clearing your search or filters to see other records." : config.emptyHint ?? `Add and manage ${config.label.toLowerCase()} here.`}
        </p>
        {isFiltered ? (
          <Link href={`/admin/r/${config.key}`} className="mt-5 inline-flex h-9 items-center rounded-xl bg-brand-600 px-4 text-[12.5px] font-bold text-white hover:bg-brand-700">Clear filters</Link>
        ) : canManage && config.canCreate !== false ? (
          <Link href={`/admin/r/${config.key}/new`} className="mt-5 inline-flex h-9 items-center rounded-xl bg-brand-600 px-4 text-[12.5px] font-semibold text-white hover:bg-brand-700">Add {config.singular}</Link>
        ) : null}
      </div>
    );
  }

  const ordered = config.orderField
    ? [...rows].sort(
        (a, b) => Number(a[config.orderField!] ?? 0) - Number(b[config.orderField!] ?? 0),
      )
    : rows;
  const primaryColumn = config.columns.find((column) => column.type !== "image");

  return (
    <>
      {/* Table on tablet and up. Keep all columns reachable at narrower widths. */}
      <div role="region" aria-label={`${config.label} table; scroll horizontally if needed`} tabIndex={0} className="hidden overflow-x-auto rounded-2xl bg-white ring-1 ring-line md:block">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line bg-surface-2/60 text-[11px] uppercase tracking-[0.08em] text-ink-400">
              {config.columns.map((column) => (
                <th key={column.name} className="px-4 py-2.5 font-bold">
                  {column.label}
                </th>
              ))}
              {config.orderField ? <th className="px-2 py-2.5 font-bold">Reorder</th> : null}
              {canManage ? <th className="px-4 py-2.5 text-right font-bold">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {ordered.map((row, index) => {
              const name = String(row.title ?? row.name ?? row.code ?? row.question ?? row.email ?? row.id);
              return (
                <tr key={String(row.id)} className="border-b border-line/70 last:border-0 hover:bg-[#f8fbf8]">
                  {config.columns.map((column) => (
                    <td key={column.name} className="px-4 py-3 align-middle text-ink-700">
                      {column === primaryColumn && canManage ? (
                        <Link href={`/admin/r/${config.key}/${row.id}`} className="font-bold text-[#294a36] hover:text-brand-700 hover:underline">
                          {String(row[column.name] ?? "—") || "Untitled"}
                        </Link>
                      ) : (
                        <CellValue column={column} value={row[column.name]} />
                      )}
                    </td>
                  ))}
                  {config.orderField ? (
                    <td className="px-2 py-2.5">
                      {canManage ? (
                        <OrderControls
                          resourceKey={config.key}
                          id={String(row.id)}
                          canMoveUp={index > 0}
                          canMoveDown={index < ordered.length - 1}
                          name={name}
                        />
                      ) : (
                        <span className="tabular-nums text-ink-500">{String(row[config.orderField] ?? "—")}</span>
                      )}
                    </td>
                  ) : null}
                  {canManage ? <td className="px-4 py-2.5 text-right">
                    <span className="inline-flex items-center gap-2">
                      {config.fields.some((field) => field.name === "visible" && field.type === "boolean") ? (
                        <VisibilityToggle resourceKey={config.key} id={String(row.id)} field="visible" value={Boolean(row.visible)} label={`Show ${name} on the website`} />
                      ) : null}
                      <Link href={`/admin/r/${config.key}/${row.id}`} className="rounded-lg bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-ink-700 hover:bg-brand-50 hover:text-brand-700">Edit</Link>
                      <RowMenu resourceKey={config.key} id={String(row.id)} name={name} canDuplicate={config.canCreate !== false} canDelete={config.canDelete !== false} />
                    </span>
                  </td> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* The same data and reorder actions remain available on phones. */}
      <ul className="space-y-3 md:hidden">
        {ordered.map((row, index) => {
          const name = String(row.title ?? row.name ?? row.code ?? row.question ?? row.email ?? row.id);
          const imageColumn = config.columns.find((column) => column.type === "image");
          const details = config.columns.filter((column) => column !== primaryColumn && column.type !== "image");
          return (
            <li key={String(row.id)} className="rounded-2xl border border-[#e4ece6] bg-white p-4">
              <div className="flex items-start gap-3">
                {imageColumn ? <CellValue column={imageColumn} value={row[imageColumn.name]} /> : null}
                <div className="min-w-0 flex-1">
                  {canManage ? <Link href={`/admin/r/${config.key}/${row.id}`} className="block break-words text-[13.5px] font-bold text-[#254734] hover:text-brand-700">{name}</Link> : <p className="break-words text-[13.5px] font-bold text-[#254734]">{name}</p>}
                </div>
                {canManage && config.fields.some((field) => field.name === "visible" && field.type === "boolean") ? (
                  <VisibilityToggle resourceKey={config.key} id={String(row.id)} field="visible" value={Boolean(row.visible)} label={`Show ${name} on the website`} />
                ) : null}
              </div>
              {details.length ? <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[#eef2ef] pt-3">{details.map((column) => (
                <div key={column.name} className="min-w-0 text-[12px]"><dt className="mb-0.5 text-[10.5px] font-semibold text-ink-500">{column.label || column.name}</dt><dd className="break-words text-ink-700"><CellValue column={column} value={row[column.name]} /></dd></div>
              ))}</dl> : null}
              {canManage ? <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#eef2ef] pt-3">
                <span className="flex items-center gap-2">
                  <Link href={`/admin/r/${config.key}/${row.id}`} className="rounded-lg bg-[#edf7f0] px-3 py-1.5 text-[11.5px] font-bold text-brand-700">Edit</Link>
                  {config.orderField ? <span className="flex items-center gap-1 text-[10.5px] font-semibold text-ink-500">Order <OrderControls resourceKey={config.key} id={String(row.id)} canMoveUp={index > 0} canMoveDown={index < ordered.length - 1} name={name} /></span> : null}
                </span>
                <RowMenu resourceKey={config.key} id={String(row.id)} name={name} canDuplicate={config.canCreate !== false} canDelete={config.canDelete !== false} />
              </div> : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
