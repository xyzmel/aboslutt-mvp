export const analyticsEventNames = [
  "account_created",
  "login_attempted",
  "login_completed",
  "login_failed",
  "onboarding_completed",
  "subscription_added",
  "subscription_updated",
  "subscription_deleted",
  "email_provider_connected",
  "email_provider_disconnected",
  "email_scan_started",
  "email_scan_completed",
  "email_scan_failed",
  "import_candidates_found",
  "subscriptions_imported",
  "cancellation_started",
  "cancellation_completed",
  "premium_viewed",
  "checkout_started",
  "checkout_cancelled",
  "checkout_failed",
  "checkout_completed",
  "premium_activated",
  "landing_page_viewed",
  "registration_started",
  "registration_completed",
  "first_subscription_added",
  "pricing_viewed",
  "vipps_redirect_started",
];

export const allowedAnalyticsPropertyKeys = new Set([
  "provider",
  "result",
  "candidate_count",
  "imported_count",
  "billing_interval",
  "plan",
  "route",
  "error_category",
  "status",
  "source",
  "method",
  "category",
]);

const sensitiveKeyPattern =
  /email|phone|name|subject|merchant|receipt|mailbox|body|content|text|reference|agreement|charge|vipps|token|secret|authorization|cookie|password|subscriptionName|providerAccountId|message/i;

const sensitiveValuePattern =
  /@|#EXT#|Bearer\s+|vipps-[a-z0-9-]{8,}|eyJ[A-Za-z0-9_-]+|access[_-]?token|refresh[_-]?token|authorization/i;

export function sanitizeAnalyticsProperties(properties = {}) {
  const sanitized = {};

  for (const [key, value] of Object.entries(properties ?? {})) {
    if (!allowedAnalyticsPropertyKeys.has(key) || sensitiveKeyPattern.test(key)) {
      continue;
    }

    if (value === null || typeof value === "undefined") {
      sanitized[key] = value;
      continue;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
      continue;
    }

    if (typeof value === "string" && value.length <= 80 && !sensitiveValuePattern.test(value)) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export function getAnalyticsRuntimeConfig(env = process.env) {
  const isProduction = env.NODE_ENV === "production";
  const locallyEnabled = env.NEXT_PUBLIC_ENABLE_ANALYTICS_LOCAL === "true";
  const posthogKey = env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ?? "";
  const consentRequired = env.NEXT_PUBLIC_ANALYTICS_CONSENT_REQUIRED === "true";

  return {
    enabled: Boolean(posthogKey && (isProduction || locallyEnabled)),
    posthogKey,
    posthogHost: env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://eu.i.posthog.com",
    consentRequired,
    environment: env.NEXT_PUBLIC_VERCEL_ENV || env.NODE_ENV || "development",
  };
}

export function hasAnalyticsConsent(storage) {
  if (!storage) {
    return false;
  }

  try {
    return storage.getItem("aboslutt:analytics-consent") === "granted";
  } catch {
    return false;
  }
}

export function shouldBlockSessionRecording(pathname = "") {
  return (
    pathname.startsWith("/import/email") ||
    pathname.startsWith("/payment") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/settings")
  );
}

export function createDedupeKey(eventName, properties = {}) {
  const sanitized = sanitizeAnalyticsProperties(properties);
  return `${eventName}:${JSON.stringify(sanitized)}`;
}

export function createAnalyticsDedupeStore() {
  const seen = new Set();

  return {
    shouldTrack(eventName, properties = {}) {
      const key = createDedupeKey(eventName, properties);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    },
    reset() {
      seen.clear();
    },
  };
}
