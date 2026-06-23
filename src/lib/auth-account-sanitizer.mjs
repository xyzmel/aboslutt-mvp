const supportedAccountFields = new Set([
  "userId",
  "type",
  "provider",
  "providerAccountId",
  "providerEmail",
  "refresh_token",
  "refresh_token_expires_in",
  "access_token",
  "expires_at",
  "token_type",
  "scope",
  "id_token",
  "session_state",
]);

export function sanitizeAuthAccount(account = {}) {
  return Object.fromEntries(
    Object.entries(account).filter(([key]) => supportedAccountFields.has(key)),
  );
}

export function createSanitizedAuthAdapter(adapter) {
  return {
    ...adapter,
    linkAccount: adapter.linkAccount
      ? (account) => adapter.linkAccount(sanitizeAuthAccount(account))
      : undefined,
    ...(adapter.updateAccount
      ? {
          updateAccount: (account) => adapter.updateAccount(sanitizeAuthAccount(account)),
        }
      : {}),
  };
}

export function getSupportedAccountFields() {
  return [...supportedAccountFields];
}
