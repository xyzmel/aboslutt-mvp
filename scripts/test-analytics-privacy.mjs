import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createAnalyticsDedupeStore,
  getAnalyticsRuntimeConfig,
  sanitizeAnalyticsProperties,
  shouldBlockSessionRecording,
} from "../src/lib/analytics-privacy.mjs";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("analytics strips sensitive customer, mailbox, and payment properties", () => {
  const sanitized = sanitizeAnalyticsProperties({
    provider: "outlook",
    result: "success",
    candidate_count: 3,
    imported_count: 2,
    billing_interval: "monthly",
    plan: "premium_monthly",
    route: "/import/email",
    email: "kunde@example.com",
    subject: "Kvittering fra Netflix",
    merchantName: "Netflix",
    paymentReference: "vipps-abc",
    token: "secret-token",
    mailbox: "kunde@example.com",
    message: "raw provider response",
  });

  assert.deepEqual(sanitized, {
    provider: "outlook",
    result: "success",
    candidate_count: 3,
    imported_count: 2,
    billing_interval: "monthly",
    plan: "premium_monthly",
    route: "/import/email",
  });
});

test("analytics deduplicates repeated events and can reset on logout", () => {
  const store = createAnalyticsDedupeStore();

  assert.equal(store.shouldTrack("checkout_started", { plan: "premium_monthly" }), true);
  assert.equal(store.shouldTrack("checkout_started", { plan: "premium_monthly" }), false);

  store.reset();
  assert.equal(store.shouldTrack("checkout_started", { plan: "premium_monthly" }), true);
});

test("analytics runs in production or explicit local opt-in only", () => {
  assert.equal(
    getAnalyticsRuntimeConfig({
      NODE_ENV: "development",
      NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
    }).enabled,
    false,
  );

  assert.equal(
    getAnalyticsRuntimeConfig({
      NODE_ENV: "development",
      NEXT_PUBLIC_ENABLE_ANALYTICS_LOCAL: "true",
      NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
    }).enabled,
    true,
  );

  assert.equal(
    getAnalyticsRuntimeConfig({
      NODE_ENV: "production",
      NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
    }).posthogHost,
    "https://eu.i.posthog.com",
  );
});

test("session recording is blocked on sensitive routes", () => {
  for (const route of [
    "/import/email",
    "/payment/thanks",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password/token",
    "/verify-email",
    "/settings",
  ]) {
    assert.equal(shouldBlockSessionRecording(route), true, route);
  }

  assert.equal(shouldBlockSessionRecording("/pricing"), false);
});

test("logout and payment status components use safe analytics behavior", async () => {
  const userMenu = await source("src/components/navigation/UserMenu.tsx");
  const mobileMenu = await source("src/components/navigation/MobileMenu.tsx");
  const settings = await source("src/components/settings/SettingsClient.tsx");
  const paymentStatus = await source("src/components/billing/PaymentStatusPoller.tsx");
  const analytics = await source("src/lib/analytics.ts");

  for (const file of [userMenu, mobileMenu, settings]) {
    assert.match(file, /resetAnalyticsIdentity/);
  }

  assert.match(paymentStatus, /status === "active"[\s\S]*checkout_completed/);
  assert.match(paymentStatus, /status === "active"[\s\S]*premium_activated/);
  assert.doesNotMatch(paymentStatus, /searchParams|get\("status"\)|query/i);

  assert.match(analytics, /try\s*{[\s\S]*posthog\.capture/);
  assert.match(analytics, /catch\s*{[\s\S]*Analytics must never block customer actions/);
});
