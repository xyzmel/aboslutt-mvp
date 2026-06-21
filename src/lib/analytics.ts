"use client";

type FunnelEventName =
  | "landing_page_viewed"
  | "registration_started"
  | "registration_completed"
  | "first_subscription_added"
  | "pricing_viewed"
  | "checkout_started"
  | "vipps_redirect_started"
  | "premium_activated"
  | "checkout_cancelled"
  | "checkout_failed";

type SafeAnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

const blockedPropertyPattern =
  /email|phone|name|reference|agreement|charge|vipps|token|secret|authorization|subscriptionName/i;

export function trackFunnelEvent(eventName: FunnelEventName, properties: SafeAnalyticsProperties = {}) {
  const payload = {
    event: eventName,
    properties: sanitizeAnalyticsProperties(properties),
    timestamp: new Date().toISOString(),
  };

  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent("aboslutt:funnel-event", { detail: payload }));

  const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT?.trim();
  if (!endpoint) {
    return;
  }

  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
    return;
  }

  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export function sanitizeAnalyticsProperties(properties: SafeAnalyticsProperties) {
  return Object.fromEntries(
    Object.entries(properties)
      .filter(([key]) => !blockedPropertyPattern.test(key))
      .filter(([, value]) => value === null || ["string", "number", "boolean", "undefined"].includes(typeof value)),
  );
}
