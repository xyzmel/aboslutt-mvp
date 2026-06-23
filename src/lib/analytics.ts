"use client";

import posthog from "posthog-js";
import {
  createAnalyticsDedupeStore,
  getAnalyticsRuntimeConfig,
  hasAnalyticsConsent,
  sanitizeAnalyticsProperties,
  shouldBlockSessionRecording,
} from "@/lib/analytics-privacy.mjs";

export type AnalyticsEventName =
  | "account_created"
  | "login_attempted"
  | "login_completed"
  | "login_failed"
  | "onboarding_completed"
  | "subscription_added"
  | "subscription_updated"
  | "subscription_deleted"
  | "email_provider_connected"
  | "email_provider_disconnected"
  | "email_scan_started"
  | "email_scan_completed"
  | "email_scan_failed"
  | "import_candidates_found"
  | "subscriptions_imported"
  | "cancellation_started"
  | "cancellation_completed"
  | "premium_viewed"
  | "checkout_started"
  | "checkout_cancelled"
  | "checkout_failed"
  | "checkout_completed"
  | "premium_activated"
  | "landing_page_viewed"
  | "registration_started"
  | "registration_completed"
  | "first_subscription_added"
  | "pricing_viewed"
  | "vipps_redirect_started";

export type SafeAnalyticsProperties = {
  provider?: "gmail" | "outlook";
  result?: "success" | "failed" | "cancelled";
  candidate_count?: number;
  imported_count?: number;
  billing_interval?: string;
  plan?: string;
  route?: string;
  error_category?: string;
  status?: string;
  source?: string;
  method?: string;
  category?: string;
};

const dedupeStore = createAnalyticsDedupeStore();
let posthogInitialized = false;
let identifiedUserId: string | null = null;

export function initializeAnalytics(pathname?: string) {
  if (typeof window === "undefined" || posthogInitialized) {
    return false;
  }

  const config = getAnalyticsRuntimeConfig(process.env);
  if (!config.enabled) {
    return false;
  }

  if (config.consentRequired && !hasAnalyticsConsent(window.localStorage)) {
    return false;
  }

  posthog.init(config.posthogKey, {
    api_host: config.posthogHost,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: shouldBlockSessionRecording(pathname ?? window.location.pathname),
    mask_all_element_attributes: true,
    mask_all_text: true,
    property_blacklist: [
      "$initial_referrer",
      "$initial_referring_domain",
      "$referrer",
      "$referring_domain",
      "$current_url",
      "email",
      "name",
      "phone",
      "token",
      "secret",
      "reference",
    ],
    session_recording: {
      maskAllInputs: true,
      maskInputOptions: {
        password: true,
        email: true,
        text: true,
        textarea: true,
      },
    },
    loaded: (client) => {
      if (shouldBlockSessionRecording(pathname ?? window.location.pathname)) {
        client.stopSessionRecording();
      }
    },
  });

  posthogInitialized = true;
  return true;
}

export function syncAnalyticsRoute(pathname: string) {
  if (!isAnalyticsReady()) {
    initializeAnalytics(pathname);
  }

  if (!isAnalyticsReady()) {
    return;
  }

  if (shouldBlockSessionRecording(pathname)) {
    posthog.stopSessionRecording();
  } else {
    posthog.startSessionRecording();
  }
}

export function identifyAnalyticsUser(userId: string | null | undefined) {
  if (!userId || typeof window === "undefined") {
    return;
  }

  initializeAnalytics();
  if (!isAnalyticsReady() || identifiedUserId === userId) {
    return;
  }

  posthog.identify(userId);
  identifiedUserId = userId;
}

export function resetAnalyticsIdentity() {
  if (typeof window === "undefined") {
    return;
  }

  dedupeStore.reset();
  identifiedUserId = null;

  if (isAnalyticsReady()) {
    posthog.reset();
  }
}

export function trackFunnelEvent(eventName: AnalyticsEventName, properties: SafeAnalyticsProperties = {}) {
  trackAnalyticsEvent(eventName, properties);
}

export function trackAnalyticsEvent(eventName: AnalyticsEventName, properties: SafeAnalyticsProperties = {}) {
  const sanitized = sanitizeAnalyticsProperties(properties) as SafeAnalyticsProperties;

  if (!dedupeStore.shouldTrack(eventName, sanitized)) {
    return;
  }

  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("aboslutt:analytics-event", {
      detail: { event: eventName, properties: sanitized },
    }),
  );

  try {
    initializeAnalytics();
    if (isAnalyticsReady()) {
      posthog.capture(eventName, sanitized);
    }
  } catch {
    // Analytics must never block customer actions.
  }
}

export function isAnalyticsReady() {
  return posthogInitialized && typeof window !== "undefined";
}

export { sanitizeAnalyticsProperties, shouldBlockSessionRecording };
