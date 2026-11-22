/** Keep the footer below the viewport while account data is loading. */
export default function AccountLoading() {
  return <div className="flex min-h-[100svh] items-start justify-center pt-20 text-sm font-semibold text-brand-700" role="status">Loading your account…</div>;
}
