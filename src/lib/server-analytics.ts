import "server-only";

import { logger } from "@/lib/logger";

type ServerFunnelEventName = "premium_activated" | "checkout_failed";
type SafeAnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

const blockedPropertyPattern =
  /email|phone|name|reference|agreement|charge|vipps|token|secret|authorization|subscriptionName/i;

export function trackServerFunnelEvent(
  eventName: ServerFunnelEventName,
  properties: SafeAnalyticsProperties = {},
) {
  logger.info("[analytics:funnel]", {
    event: eventName,
    properties: sanitizeAnalyticsProperties(properties),
  });
}

function sanitizeAnalyticsProperties(properties: SafeAnalyticsProperties) {
  return Object.fromEntries(
    Object.entries(properties)
      .filter(([key]) => !blockedPropertyPattern.test(key))
      .filter(([, value]) => value === null || ["string", "number", "boolean", "undefined"].includes(typeof value)),
  );
}
