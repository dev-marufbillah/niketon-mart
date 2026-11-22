import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { requirePermission } from "@/lib/auth/session";
import { getSettings } from "@/lib/repositories/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Site settings" };

export default async function AdminSettingsPage() {
  await requirePermission("settings.manage");
  const settings = await getSettings();

  return (
    <div>
      <AdminPageHeader
        title="Site settings"
        description="The identity, contact details, shopping rules and footer of the whole website. Changes apply on save."
        meta="Requires settings management permission."
      />
      <SettingsForm settings={settings} />
    </div>
  );
}
