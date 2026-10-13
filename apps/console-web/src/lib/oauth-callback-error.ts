// Only public account error codes may cross the OAuth redirect or be read from its URL.
const callbackErrors = [
  "oauth_invalid", "use_existing_account", "method_unavailable", "reauth_required",
  "session_invalid", "csrf_invalid", "provider_unavailable", "rate_limited",
  "account_unavailable", "mail_unavailable", "email_invalid",
] as const;
export type OAuthCallbackError = typeof callbackErrors[number];
export function oauthCallbackError(value: unknown, fallback: OAuthCallbackError = "oauth_invalid"): OAuthCallbackError {
  return callbackErrors.find(code => code === value) ?? fallback;
}
