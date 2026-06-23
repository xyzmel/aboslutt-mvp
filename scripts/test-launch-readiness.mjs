import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("funnel analytics events are implemented without sensitive properties", async () => {
  const analytics = await source("src/lib/analytics.ts");
  const analyticsPrivacy = await source("src/lib/analytics-privacy.mjs");
  const dashboard = await source("src/components/dashboard/DashboardClient.tsx");
  const checkout = await source("src/components/billing/CheckoutButton.tsx");
  const payment = await source("src/components/billing/PaymentStatusPoller.tsx");

  for (const eventName of [
    "landing_page_viewed",
    "registration_started",
    "registration_completed",
    "first_subscription_added",
    "pricing_viewed",
    "checkout_started",
    "vipps_redirect_started",
    "premium_activated",
    "checkout_cancelled",
    "checkout_failed",
  ]) {
    assert.match(`${analytics}\n${dashboard}\n${checkout}\n${payment}`, new RegExp(eventName));
  }

  assert.match(analyticsPrivacy, /sensitiveKeyPattern/);
  assert.match(analyticsPrivacy, /email\|phone\|name\|subject\|merchant\|receipt\|mailbox/);
  assert.match(analyticsPrivacy, /reference\|agreement\|charge\|vipps\|token\|secret/);
  assert.doesNotMatch(dashboard, /trackFunnelEvent\("[^"]+",\s*\{\s*name:/);
  assert.doesNotMatch(dashboard, /trackFunnelEvent\("[^"]+",\s*\{\s*subscriptionName:/);
  assert.doesNotMatch(dashboard, /trackFunnelEvent\("[^"]+",\s*\{[^}]*subscription\.name/);
  assert.doesNotMatch(checkout, /reference|providerAgreementId|providerChargeId/);
});

test("SEO excludes private app surfaces and includes public sitemap routes", async () => {
  const robots = await source("src/app/robots.ts");
  const sitemap = await source("src/app/sitemap.ts");
  const layout = await source("src/app/layout.tsx");

  for (const privatePath of ["/admin", "/api", "/dashboard", "/import", "/onboarding", "/settings", "/subscriptions"]) {
    assert.match(robots, new RegExp(privatePath));
  }

  for (const publicPath of ["/pricing", "/contact", "/privacy", "/terms", "/terms/sales", "/login", "/register"]) {
    assert.match(sitemap, new RegExp(publicPath));
  }

  assert.match(layout, /metadataBase/);
  assert.match(layout, /openGraph/);
});

test("launch checklist is documented", async () => {
  const readme = await source("README.md");

  for (const item of [
    "production env",
    "webhook registration",
    "real Vipps payment",
    "cancelled Vipps payment",
    "Premium activation",
    "Analytics is verified",
    "database backup",
    "admin access",
  ]) {
    assert.match(readme.toLowerCase(), new RegExp(item.toLowerCase()));
  }
});
