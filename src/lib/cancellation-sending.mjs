export const cancellationAuthorizationVersion = "cancellation-send-v1";
export const cancellationSendingModes = ["aboslutt_email", "provider_portal", "manual_draft"];
export const sendingVerificationMaxAgeMs = 180 * 24 * 60 * 60 * 1000;
export const recentAuthenticationMaxAgeMs = 15 * 60 * 1000;

export function getCancellationSendingCapability(provider, now = new Date()) {
  if (!provider || provider.isActive === false || provider.isCancellationGuideActive !== true) {
    return { allowed: false, reason: "CAPABILITY_MISSING" };
  }

  if (provider.supportsAbosluttSending !== true) {
    return { allowed: false, reason: "CAPABILITY_MISSING" };
  }

  const recipient = normalizeEmail(provider.verifiedCancellationEmail);
  if (!recipient) {
    return { allowed: false, reason: "RECIPIENT_MISSING" };
  }

  const verifiedAt = toDate(provider.sendingVerifiedAt);
  if (!verifiedAt || now.getTime() - verifiedAt.getTime() > sendingVerificationMaxAgeMs) {
    return { allowed: false, reason: "VERIFICATION_STALE" };
  }

  return { allowed: true, recipient, verifiedAt };
}

export function getRecommendedCancellationMode(provider, now = new Date()) {
  if (getCancellationSendingCapability(provider, now).allowed) {
    return "aboslutt_email";
  }

  if (
    provider?.isCancellationGuideActive === true &&
    ["website", "app"].includes(provider?.cancellationMethod) &&
    Boolean(provider?.cancellationUrl || provider?.accountManagementUrl)
  ) {
    return "provider_portal";
  }

  return "manual_draft";
}

export function isRecentAuthentication(authenticatedAt, now = Date.now()) {
  const value = typeof authenticatedAt === "number" ? authenticatedAt : new Date(authenticatedAt ?? 0).getTime();
  return Number.isFinite(value) && value > 0 && now - value <= recentAuthenticationMaxAgeMs;
}

export function normalizeCancellationMode(value) {
  return cancellationSendingModes.includes(value) ? value : "manual_draft";
}

function normalizeEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
