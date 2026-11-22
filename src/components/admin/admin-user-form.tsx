"use client";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { inviteAdminAction, saveAdminUserAction, resendInviteAction, type AdminUserState } from "@/lib/admin/user-actions";
import { PERMISSIONS, roleDefinitions, type AdminRole, type Permission } from "@/lib/auth/permissions";

const input = "h-10 w-full rounded-xl border border-line bg-white px-3 text-[13px] outline-none focus:border-brand-500";
const label = "mb-1.5 block text-[12px] font-semibold text-ink-700";
type User = { id: string; name: string; email: string; role: AdminRole; active: boolean; permissions?: Permission[]; invitationStatus?: string };
function Submit({ text }: { text: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="inline-flex h-10 items-center rounded-full bg-brand-600 px-5 text-[13px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "Working…" : text}</button>;
}
function Feedback({ state }: { state: AdminUserState }) {
  return <>{state?.errors?.length ? <ul role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-600">{state.errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
    {state?.success ? <p role="status" className="rounded-xl bg-brand-50 px-3 py-2 text-[12px] text-brand-700">{state.success}</p> : null}</>;
}
export function AdminUserForm({ user }: { user?: User }) {
  const [role, setRole] = useState<AdminRole>(user?.role === "owner" ? "admin" : user?.role ?? "product_manager");
  const [state, action] = useActionState<AdminUserState, FormData>(user ? saveAdminUserAction.bind(null, user.id) : inviteAdminAction, null);
  const [resendState, resendAction] = useActionState<AdminUserState, FormData>(user ? resendInviteAction.bind(null, user.id) : async () => null, null);
  const pendingInvite = !!user && ["pending", "sent", "failed"].includes(user.invitationStatus ?? "");
  return <div className="space-y-5">
    <form action={action} className="space-y-3.5">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className="block"><span className={label}>Full name</span><input name="name" defaultValue={user?.name} required maxLength={100} className={input} /></label>
        <label className="block"><span className={label}>Email (used to sign in)</span><input name="email" type="email" defaultValue={user?.email} required readOnly={!!user} className={input} /></label>
        <label className="block sm:col-span-2"><span className={label}>Role</span><select name="role" value={role} onChange={(event) => setRole(event.target.value as AdminRole)} className={input}>
          {(Object.keys(roleDefinitions) as AdminRole[]).filter((entry) => entry !== "owner").map((entry) => <option key={entry} value={entry}>{roleDefinitions[entry].label} — {roleDefinitions[entry].description}</option>)}
        </select></label>
        {role === "custom" ? <fieldset className="sm:col-span-2"><legend className={label}>Custom permissions</legend><div className="grid gap-2 sm:grid-cols-2">{PERMISSIONS.filter((permission) => permission !== "users.manage").map((permission) => <label key={permission} className="flex items-center gap-2 text-[12px]"><input type="checkbox" name="permissions" value={permission} defaultChecked={user?.permissions?.includes(permission)} className="accent-brand-600" />{permission}</label>)}</div><p className="mt-2 text-xs text-ink-500">Admin-user management is reserved for the Super Admin. Dashboard access is always included.</p></fieldset> : null}
        {user ? <label className="flex items-center gap-2.5 sm:col-span-2"><input type="checkbox" name="active" disabled={pendingInvite} defaultChecked={user.active} className="size-4 accent-brand-600" /><span className="text-[12.5px] font-semibold text-ink-700">Account active {pendingInvite ? "(invitation must be accepted first)" : "(disabling revokes current sessions)"}</span></label> : <p className="text-xs leading-relaxed text-ink-500 sm:col-span-2">An invitation link is emailed to this person. They choose their own password; the account remains inactive until setup is complete.</p>}
      </div>
      <Feedback state={state} /><Submit text={user ? "Save account" : "Send invitation"} />
    </form>
    {user && !user.active ? <form action={resendAction} className="space-y-3 border-t border-line pt-4"><p className="text-xs text-ink-500">Sending a new setup link invalidates any previous invitation.</p><Feedback state={resendState} /><Submit text="Send new setup link" /></form> : null}
  </div>;
}
