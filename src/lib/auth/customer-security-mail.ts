import "server-only";
import type { Database } from "@/lib/db/types";
import type { CustomerProfile } from "@/lib/repositories/accounts";
import { isCustomerMailConfigured, sendCustomerLink } from "@/lib/auth/admin-mail";
import {
  discardCustomerEmailVerificationInDatabase,
  issueCustomerEmailVerificationInDatabase,
} from "@/lib/auth/customer-credentials";

/** Caller has just created the account or reauthenticated its password.
 * A provider's HTTP acceptance does not prove inbox delivery. */
export async function sendCustomerVerification(db: Database, profile: CustomerProfile, email: string): Promise<"not-configured" | "changed" | "failed" | "accepted"> {
  if (!isCustomerMailConfigured()) return "not-configured";
  const pending = await issueCustomerEmailVerificationInDatabase(db, profile, email);
  if (!pending) return "changed";
  const accepted = await sendCustomerLink(pending.email, pending.token, "verify");
  if (!accepted) {
    await discardCustomerEmailVerificationInDatabase(db, pending);
    return "failed";
  }
  return "accepted";
}
