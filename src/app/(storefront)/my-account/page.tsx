import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/auth/customer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My Account", robots: { index: false, follow: false } };

/**
 * `/my-account` is the dashboard entry point. Signed-out shoppers go to the
 * sign-in page; signed-in shoppers land on their details, which is the first
 * tab in the reference design.
 */
export default async function MyAccountIndex() {
  const session = await getCustomerSession();
  redirect(session ? "/my-account/personal-information" : "/my-account/login?next=/my-account/personal-information");
}
