import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Niketon Mart Admin" },
  robots: { index: false, follow: false },
};

/**
 * The admin root layout stays deliberately thin: the authenticated shell lives in
 * the `(panel)` route group so the login screen renders without a sidebar.
 */
export default function AdminRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
