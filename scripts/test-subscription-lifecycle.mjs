import test from "node:test";
import assert from "node:assert/strict";
import {
  getSubscriptionLifecycle,
  shouldIncludeUpcomingPayment,
  validateSubscriptionDeletion,
} from "../src/lib/subscription-lifecycle.mjs";

test("active subscriptions can be edited and started for cancellation, but not deleted", () => {
  const lifecycle = getSubscriptionLifecycle({ status: "active" });

  assert.equal(lifecycle.productStatus, "active");
  assert.equal(lifecycle.appearsInActiveList, true);
  assert.equal(lifecycle.appearsInHistory, false);
  assert.equal(lifecycle.actions.canEdit, true);
  assert.equal(lifecycle.actions.canStartCancellation, true);
  assert.equal(lifecycle.actions.canDelete, false);
  assert.equal(shouldIncludeUpcomingPayment({ status: "active" }), true);
});

test("open cancellation requests move subscriptions into cancellation in progress", () => {
  for (const status of ["draft", "ready", "sent", "awaiting_confirmation", "manual_required", "rejected"]) {
    const lifecycle = getSubscriptionLifecycle({ status: "active", cancellationStatus: status });

    assert.equal(lifecycle.productStatus, "cancellation_in_progress");
    assert.equal(lifecycle.appearsInActiveList, true);
    assert.equal(lifecycle.appearsInHistory, false);
    assert.equal(lifecycle.actions.canStartCancellation, false);
    assert.equal(lifecycle.actions.canContinueCancellation, true);
    assert.equal(lifecycle.actions.canDelete, false);
    assert.equal(shouldIncludeUpcomingPayment({ status: "active", cancellationStatus: status }), false);
  }
});

test("confirmed cancellation wins over stale active subscription status", () => {
  const lifecycle = getSubscriptionLifecycle({
    status: "active",
    cancellationRequest: { status: "confirmed_cancelled" },
  });

  assert.equal(lifecycle.productStatus, "cancelled");
  assert.equal(lifecycle.appearsInActiveList, false);
  assert.equal(lifecycle.appearsInHistory, true);
  assert.equal(lifecycle.actions.canStartCancellation, false);
  assert.equal(lifecycle.actions.canDelete, true);
  assert.equal(shouldIncludeUpcomingPayment({ status: "active", cancellationRequest: { status: "confirmed_cancelled" } }), false);
});

test("cancelled subscriptions are history items and require typed delete confirmation", () => {
  const subscription = { status: "cancelled" };
  const lifecycle = getSubscriptionLifecycle(subscription);

  assert.equal(lifecycle.productStatus, "cancelled");
  assert.equal(lifecycle.appearsInHistory, true);
  assert.equal(lifecycle.actions.canEdit, false);
  assert.equal(lifecycle.actions.canStartCancellation, false);
  assert.equal(lifecycle.actions.canDelete, true);
  assert.deepEqual(validateSubscriptionDeletion(subscription, null).ok, false);
  assert.deepEqual(validateSubscriptionDeletion(subscription, "SLETT").ok, true);
});

test("active and in-progress subscriptions reject permanent deletion", () => {
  const activeResult = validateSubscriptionDeletion({ status: "active" }, "SLETT");
  const inProgressResult = validateSubscriptionDeletion({ status: "active", cancellationStatus: "sent" }, "SLETT");

  assert.equal(activeResult.ok, false);
  assert.equal(activeResult.status, 409);
  assert.equal(activeResult.error, "CANCELLATION_REQUIRED");
  assert.equal(activeResult.message, "Abonnementet må avsluttes før det kan fjernes.");
  assert.equal(inProgressResult.ok, false);
  assert.equal(inProgressResult.status, 409);
});

test("archived subscriptions can be restored or permanently deleted with confirmation", () => {
  const lifecycle = getSubscriptionLifecycle({ status: "archived" });

  assert.equal(lifecycle.productStatus, "archived");
  assert.equal(lifecycle.appearsInActiveList, false);
  assert.equal(lifecycle.appearsInHistory, false);
  assert.equal(lifecycle.actions.canRestore, true);
  assert.equal(lifecycle.actions.canDelete, true);
  assert.equal(validateSubscriptionDeletion({ status: "archived" }, "SLETT").ok, true);
});
