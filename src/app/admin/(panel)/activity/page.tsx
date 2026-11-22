import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/session";
import { listActivity } from "@/lib/repositories/activity";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Activity log" };

const actionTone: Record<string, string> = {
  create: "bg-brand-50 text-brand-700",
  update: "bg-surface text-ink-600",
  delete: "bg-red-50 text-red-600",
  "sign-in": "bg-accent-50 text-accent-700",
  settings: "bg-brand-50 text-brand-700",
  stock: "bg-accent-50 text-accent-700",
  order: "bg-surface text-ink-600",
  media: "bg-surface text-ink-600",
};

export default async function AdminActivityPage() {
  await requirePermission("settings.manage");
  const entries = await listActivity(200);

  return (
    <div>
      <AdminPageHeader
        title="Activity log"
        description="A permanent record of every change made in the admin panel — who did what, and when."
        meta={`${entries.length} most recent entries`}
      />

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
          <p className="text-[15px] font-bold text-ink-800">No activity yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-ink-500">
            Saves, deletions, stock changes and sign-ins are recorded here automatically.
          </p>
        </div>
      ) : (
        <ol className="space-y-1.5">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-line">
              <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${actionTone[entry.action] ?? "bg-surface text-ink-600"}`}>
                {entry.action}
              </span>
              <span className="min-w-0 flex-1 text-[12.5px] text-ink-700">{entry.summary}</span>
              <span className="text-[11px] text-ink-400">{entry.actor}</span>
              <span className="text-[11px] tabular-nums text-ink-400">
                {new Date(entry.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-4 text-[11.5px] text-ink-400">
        Looking for something specific? Open the matching module from the{" "}
        <Link href="/admin" className="font-semibold text-brand-700">dashboard</Link>.
      </p>
    </div>
  );
}
