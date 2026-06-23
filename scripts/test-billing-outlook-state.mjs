import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSettingsBillingState } from "../src/lib/settings-billing-state.mjs";
import { getOutlookDisplayState, shouldApplyConnectionResponse } from "../src/lib/outlook-provider-state.mjs";

const expiredAgreement = {
  plan: "premium_monthly",
  status: "expired",
  priceNok: 79,
  interval: "month",
  currency: "NOK",
  activatedAt: "2026-01-01T00:00:00.000Z",
  cancelledAt: null,
  expiresAt: "2026-02-01T00:00:00.000Z",
};

test("free user with no previous Premium subscription shows current free plan only", () => {
  assert.deepEqual(normalizeSettingsBillingState({ plan: "free", agreement: null }), {
    currentPlan: "free",
    entitlementActive: false,
    subscriptionStatus: "none",
    price: null,
    currency: null,
    billingInterval: null,
    activatedAt: null,
    expiresAt: null,
    historicalAgreement: null,
  });
});

test("free user with expired Premium keeps expired data historical", () => {
  const state = normalizeSettingsBillingState({ plan: "free", agreement: expiredAgreement });

  assert.equal(state.currentPlan, "free");
  assert.equal(state.entitlementActive, false);
  assert.equal(state.subscriptionStatus, "expired");
  assert.equal(state.price, null);
  assert.equal(state.billingInterval, null);
  assert.equal(state.activatedAt, null);
  assert.equal(state.expiresAt, null);
  assert.equal(state.historicalAgreement, expiredAgreement);
});

test("active Premium user shows active paid billing data", () => {
  const activeAgreement = {
    ...expiredAgreement,
    status: "active",
    expiresAt: "2026-07-01T00:00:00.000Z",
  };
  const state = normalizeSettingsBillingState({ plan: "premium", agreement: activeAgreement });

  assert.equal(state.currentPlan, "premium");
  assert.equal(state.entitlementActive, true);
  assert.equal(state.subscriptionStatus, "active");
  assert.equal(state.price, 79);
  assert.equal(state.currency, "NOK");
  assert.equal(state.billingInterval, "monthly");
  assert.equal(state.activatedAt, activeAgreement.activatedAt);
  assert.equal(state.expiresAt, activeAgreement.expiresAt);
});

test("Premium cancellation scheduled remains Premium without expired summary", () => {
  const state = normalizeSettingsBillingState({
    plan: "premium",
    agreement: { ...expiredAgreement, status: "cancellation_pending", expiresAt: "2026-07-01T00:00:00.000Z" },
  });

  assert.equal(state.currentPlan, "premium");
  assert.equal(state.subscriptionStatus, "cancellation_scheduled");
  assert.equal(state.price, 79);
});

test("pending Premium payment does not activate current entitlement", () => {
  const state = normalizeSettingsBillingState({
    plan: "free",
    agreement: { ...expiredAgreement, status: "pending", expiresAt: null, activatedAt: null },
  });

  assert.equal(state.currentPlan, "free");
  assert.equal(state.entitlementActive, false);
  assert.equal(state.subscriptionStatus, "pending");
  assert.equal(state.price, null);
});

test("Outlook loading state stays neutral", () => {
  assert.equal(getOutlookDisplayState({ state: "loading", connected: false, configured: false }), "loading");
});

test("Outlook disconnected, connected, and unavailable states are explicit", () => {
  assert.equal(getOutlookDisplayState({ state: "not_connected", connected: false, configured: true }), "disconnected");
  assert.equal(getOutlookDisplayState({ state: "connected", connected: true, configured: true }), "connected");
  assert.equal(getOutlookDisplayState({ state: "not_connected", connected: false, configured: false }), "unavailable");
});

test("Outlook stale requests cannot overwrite newer state", () => {
  assert.equal(shouldApplyConnectionResponse(1, 2), false);
  assert.equal(shouldApplyConnectionResponse(2, 2), true);
});
