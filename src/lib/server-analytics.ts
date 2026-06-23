import "server-only";

import { sanitizeAnalyticsProperties } from "@/lib/analytics-privacy.mjs";
import { logger } from "@/lib/logger";

type ServerAnalyticsEventName =
  | "account_created"
  | "login_completed"
  | "subscription_added"
  | "subscription_updated"
  | "subscription_deleted"
  | "email_provider_connected"
  | "email_provider_disconnected"
  | "email_scan_started"
  | "email_scan_completed"
  | "email_scan_failed"
  | "subscriptions_imported"
  | "cancellation_started"
  | "cancellation_completed"
  | "checkout_started"
  | "checkout_cancelled"
  | "checkout_failed"
  | "checkout_completed"
  | "premium_activated";

type SafeAnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

export function trackServerFunnelEvent(
  eventName: ServerAnalyticsEventName,
  properties: SafeAnalyticsProperties = {},
  userId?: string | null,
) {
  const sanitized = sanitizeAnalyticsProperties(properties) as Record<string, unknown>;
  logger.info("[analytics:funnel]", {
    event: eventName,
    properties: sanitized,
    userId,
  });

  sendPostHogServerEvent(eventName, sanitized, userId).catch((error: unknown) => {
    logger.warn("[analytics:posthog]", {
      error,
      event: eventName,
    });
  });
}

async function sendPostHogServerEvent(
  eventName: ServerAnalyticsEventName,
  properties: Record<string, unknown>,
  userId?: string | null,
) {
  const key = process.env.POSTHOG_PROJECT_API_KEY?.trim() || process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  const host = process.env.POSTHOG_HOST?.trim() || process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://eu.i.posthog.com";
  const enabled = Boolean(key && process.env.NODE_ENV === "production");

  if (!enabled) {
    return;
  }

  await fetch(`${host.replace(/\/$/, "")}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      event: eventName,
      distinct_id: userId ?? "server",
      properties: {
        ...properties,
        $process_person_profile: false,
      },
    }),
    cache: "no-store",
  });
}
