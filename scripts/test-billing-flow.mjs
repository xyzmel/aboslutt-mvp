import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("checkout requires authentication", async () => {
  const checkout = await source("src/app/api/billing/checkout/route.ts");

  assert.match(checkout, /getCurrentUser\(\)/);
  assert.match(checkout, /unauthorizedResponse\(\)/);
});

test("checkout rejects invalid plans", async () => {
  const checkout = await source("src/app/api/billing/checkout/route.ts");

  assert.match(checkout, /INVALID_PLAN/);
  assert.match(checkout, /premium_monthly/);
  assert.match(checkout, /premium_yearly/);
});

test("checkout reports missing Vipps config before creating a payment", async () => {
  const checkout = await source("src/app/api/billing/checkout/route.ts");
  const configCheckIndex = checkout.indexOf("!isVippsRecurringConfigured()");
  const createIndex = checkout.indexOf("prisma.billingAgreement.create");

  assert.notEqual(configCheckIndex, -1);
  assert.notEqual(createIndex, -1);
  assert.ok(configCheckIndex < createIndex);
  assert.match(checkout, /PAYMENTS_NOT_CONFIGURED/);
});

test("checkout creates a pending BillingAgreement only", async () => {
  const checkout = await source("src/app/api/billing/checkout/route.ts");

  assert.match(checkout, /prisma\.billingAgreement\.create/);
  assert.match(checkout, /status:\s*"pending"/);
});

test("checkout never activates Premium", async () => {
  const checkout = await source("src/app/api/billing/checkout/route.ts");

  assert.doesNotMatch(checkout, /user\.update/);
  assert.doesNotMatch(checkout, /plan:\s*"premium"/);
});

test("valid webhook can activate Premium only after verified Vipps status", async () => {
  const webhook = await source("src/app/api/billing/vipps/webhook/route.ts");

  assert.match(webhook, /verifyWebhookSignature/);
  assert.match(webhook, /getAgreement\(providerAgreementId\)/);
  assert.match(webhook, /isActiveVippsAgreement/);
  assert.match(webhook, /applyVerifiedBillingStatus\(agreement,\s*"active"\)/);
});

test("duplicate webhook events are idempotent and return 200", async () => {
  const webhook = await source("src/app/api/billing/vipps/webhook/route.ts");

  assert.match(webhook, /providerEventId/);
  assert.match(webhook, /isDuplicate\s*=\s*true/);
  assert.match(webhook, /duplicate:\s*isDuplicate/);
});

test("cancelled, expired, aborted, and terminated events do not activate Premium", async () => {
  const webhook = await source("src/app/api/billing/vipps/webhook/route.ts");

  assert.match(webhook, /epayments\.payment\.aborted\.v1/);
  assert.match(webhook, /epayments\.payment\.cancelled\.v1/);
  assert.match(webhook, /epayments\.payment\.expired\.v1/);
  assert.match(webhook, /epayments\.payment\.terminated\.v1/);
  assert.match(webhook, /markAgreementInactive/);
});

test("webhook retry handling distinguishes invalid, malformed, duplicate, and retryable events", async () => {
  const webhook = await source("src/app/api/billing/vipps/webhook/route.ts");

  assert.match(webhook, /INVALID_SIGNATURE/);
  assert.match(webhook, /status:\s*401/);
  assert.match(webhook, /MALFORMED_PAYLOAD/);
  assert.match(webhook, /status:\s*400/);
  assert.match(webhook, /RETRYABLE_WEBHOOK_ERROR/);
  assert.match(webhook, /status:\s*retryable\s*\?\s*503\s*:\s*500/);
});

test("cancelling an agreement does not trust frontend agreement IDs", async () => {
  const cancel = await source("src/app/api/billing/cancel/route.ts");

  assert.match(cancel, /export async function POST\(\)/);
  assert.doesNotMatch(cancel, /request\.json/);
  assert.match(cancel, /userId:\s*currentUser\.id/);
  assert.match(cancel, /status:\s*"active"/);
  assert.match(cancel, /providerAgreementId:\s*\{\s*not:\s*null\s*\}/s);
});

test("admin and beta users are not downgraded incorrectly", async () => {
  const reconcile = await source("src/lib/billing/reconcile.ts");

  assert.match(reconcile, /user\.plan === "admin"/);
  assert.match(reconcile, /user\.plan === "beta"/);
  assert.match(reconcile, /data:\s*\{\s*plan:\s*"free"\s*\}/s);
});

test("admin reconciliation is admin-only and verifies Vipps server-side", async () => {
  const route = await source("src/app/api/admin/billing/reconcile/route.ts");
  const reconcile = await source("src/lib/billing/reconcile.ts");

  assert.match(route, /isAdminUser/);
  assert.match(route, /FORBIDDEN/);
  assert.match(route, /reconcileStalePendingBillingAgreements/);
  assert.match(reconcile, /createdAt:\s*\{\s*lt:\s*cutoff\s*\}/s);
  assert.match(reconcile, /getAgreement\(agreement\.providerAgreementId\)/);
});
