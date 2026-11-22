const messages: Record<string, string> = {
  not_configured: "Google sign-in is not set up yet. Please use your email and password for now.",
  rate_limited: "Too many Google sign-in attempts. Please try again later.",
  invalid_flow: "Your Google sign-in request expired or could not be verified. Please start again.",
  cancelled: "Google sign-in was cancelled. You can try again when you are ready.",
  verification_failed: "Google sign-in could not be verified. Please try again or use your password.",
  existing_account: "An account already uses this email. Sign in with your password, then connect Google in Personal Information.",
  blocked: "This account is deactivated. Please contact the store.",
  identity_used: "This Google account is already connected to a customer account, or another Google account is connected here.",
  wrong_email: "Choose the Google account with the same email as your customer account.",
  changed: "Your account or session changed during connection. Sign in again and retry.",
  invalid: "The Google account could not be connected. Please contact the store if this continues.",
};

export function googleMessage(code: string | undefined): string | undefined {
  return code ? messages[code] : undefined;
}
