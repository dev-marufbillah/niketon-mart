/**
 * Dashboard pages are wrapped by `AccountShell`, which performs the session
 * check per page (it needs the signed-in customer for the sidebar anyway).
 * Sign-in and registration live in the sibling `(auth)` route group.
 */
export default function AccountDashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
