export const microsoftCommonAuthority = "https://login.microsoftonline.com/common";

export function getMicrosoftAuthorizeUrlBase() {
  return `${microsoftCommonAuthority}/oauth2/v2.0/authorize`;
}

export function getMicrosoftTokenUrl() {
  return `${microsoftCommonAuthority}/oauth2/v2.0/token`;
}

export function isTenantSpecificMicrosoftAuthority(tenantId) {
  const value = String(tenantId ?? "").trim();
  return Boolean(value && value.toLowerCase() !== "common");
}

export function getMicrosoftConnectionState({ hasAccount, credentialsValid, reconnectRequired }) {
  if (!hasAccount) {
    return "disconnected";
  }

  if (reconnectRequired || !credentialsValid) {
    return "expired";
  }

  return "connected";
}

export function normalizeMicrosoftProfile(profile) {
  const providerAccountId = typeof profile?.id === "string" ? profile.id : "";
  const providerEmail = sanitizeMicrosoftMailboxAddress(
    typeof profile?.mail === "string" && profile.mail
      ? profile.mail
      : typeof profile?.userPrincipalName === "string"
        ? profile.userPrincipalName
        : null,
  );

  return { providerAccountId, providerEmail };
}

export function sanitizeMicrosoftMailboxAddress(value) {
  const decoded = decodeURIComponent(String(value ?? "").trim());

  if (!decoded || decoded.includes("#EXT#")) {
    return null;
  }

  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(decoded)) {
    return null;
  }

  const match = decoded.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] ?? null;
}

export function mergeMicrosoftRefreshToken(previousRefreshToken, tokenResponse) {
  return tokenResponse?.refresh_token || previousRefreshToken || null;
}

export function getStaleMicrosoftAccountIds(accounts, userId, nextProviderAccountId) {
  return accounts
    .filter((account) => account?.userId === userId)
    .filter((account) => account.providerAccountId !== nextProviderAccountId)
    .map((account) => account.id);
}

export function isMicrosoftReconnectTokenError(status, body) {
  const error = String(body?.error ?? "").toLowerCase();
  const description = String(body?.error_description ?? "").toLowerCase();

  return (
    status === 400 &&
    (error === "invalid_grant" ||
      error === "invalid_token" ||
      description.includes("revoked") ||
      description.includes("expired") ||
      description.includes("account") ||
      description.includes("consent"))
  );
}

export function getMicrosoftScanErrorCode(code) {
  if (code === "MICROSOFT_RECONNECT_REQUIRED") {
    return "RECONNECT_REQUIRED";
  }

  if (code === "MICROSOFT_GRAPH_UNAUTHORIZED") {
    return "GRAPH_UNAUTHORIZED";
  }

  if (code === "MICROSOFT_THROTTLED") {
    return "MICROSOFT_THROTTLED";
  }

  return "SCAN_FAILED";
}
