import { redirect } from "next/navigation";

/** Old staff sign-in URL remains a safe alias for the shared sign-in form. */
export default function AdminLoginPage() {
  redirect("/my-account/login?next=%2Fadmin");
}
