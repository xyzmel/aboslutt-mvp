import test from "node:test";
import assert from "node:assert/strict";
import {
  detectBillingInterval,
  detectOutlookSubscriptionCandidates,
  extractAmountAndCurrency,
} from "../src/lib/microsoft-outlook-detector.mjs";
import {
  matchSelectedOutlookCandidates,
  summarizeOutlookImportResults,
  validateOutlookCandidateForImport,
  validateOutlookScanAccess,
} from "../src/lib/outlook-import-validation.mjs";

function message(overrides = {}) {
  return {
    id: overrides.id ?? "m1",
    subject: overrides.subject ?? "Your Spotify Premium subscription receipt",
    from: overrides.from ?? { emailAddress: { address: "receipts@spotify.com", name: "Spotify" } },
    receivedDateTime: overrides.receivedDateTime ?? "2026-06-01T10:00:00.000Z",
    bodyPreview:
      overrides.bodyPreview ??
      "Receipt for your monthly subscription. Your next payment is NOK 129 on July 1.",
    hasAttachments: overrides.hasAttachments ?? false,
    webLink: overrides.webLink ?? "https://outlook.office.com/mail/id/test",
  };
}

test("detects subscription keywords with multiple supporting signals", () => {
  const candidates = detectOutlookSubscriptionCandidates([
    message({
      subject: "Netflix subscription renewal",
      from: { emailAddress: { address: "info@netflix.com", name: "Netflix" } },
      bodyPreview: "Your monthly subscription renews automatically. Receipt total NOK 109. Next payment July 3.",
    }),
  ]);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].providerName, "Netflix");
  assert.equal(candidates[0].confidence, "high");
});

test("extracts amount and currency", () => {
  assert.deepEqual(extractAmountAndCurrency("Total paid: NOK 129 for monthly subscription"), {
    amount: 129,
    currency: "NOK",
  });
  assert.deepEqual(extractAmountAndCurrency("Annual renewal amount 99.00 USD"), {
    amount: 99,
    currency: "USD",
  });
});

test("detects billing interval", () => {
  assert.equal(detectBillingInterval("Your monthly subscription renews"), "monthly");
  assert.equal(detectBillingInterval("Annual membership renewal"), "yearly");
  assert.equal(detectBillingInterval("Receipt for payment"), "unknown");
});

test("groups repeated receipts from same service", () => {
  const candidates = detectOutlookSubscriptionCandidates([
    message({
      id: "old",
      receivedDateTime: "2026-04-01T10:00:00.000Z",
      bodyPreview: "Monthly subscription receipt. Total NOK 119. Next payment May 1.",
    }),
    message({
      id: "new",
      receivedDateTime: "2026-06-01T10:00:00.000Z",
      bodyPreview: "Monthly subscription receipt. Total NOK 129. Next payment July 1.",
    }),
  ]);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].grouped, true);
  assert.equal(candidates[0].relatedMessageCount, 2);
  assert.equal(candidates[0].amount, 129);
});

test("does not classify one-time purchases from broad retailers", () => {
  const candidates = detectOutlookSubscriptionCandidates([
    message({
      subject: "Your Amazon order receipt",
      from: { emailAddress: { address: "order-update@amazon.com", name: "Amazon" } },
      bodyPreview: "Receipt for your order. Total USD 49.99. Your package has shipped.",
    }),
  ]);

  assert.equal(candidates.length, 0);
});

function storedCandidate(overrides = {}) {
  return {
    id: overrides.id ?? "candidate-1",
    providerName: overrides.providerName ?? "Spotify",
    senderDomain: overrides.senderDomain ?? "spotify.com",
    subject: overrides.subject ?? "Spotify Premium receipt",
    receivedDate: overrides.receivedDate ?? "2026-06-01T10:00:00.000Z",
    amount: overrides.amount ?? 129,
    currency: overrides.currency ?? "NOK",
    billingInterval: overrides.billingInterval ?? "monthly",
    confidence: overrides.confidence ?? "high",
    reasons: overrides.reasons ?? ["Abonnement nevnt", "Belop funnet"],
    grouped: overrides.grouped ?? true,
    relatedMessageCount: overrides.relatedMessageCount ?? 2,
  };
}

test("validates scan ownership before import", () => {
  const access = validateOutlookScanAccess(
    { userId: "user-a", status: "pending", expiresAt: new Date(Date.now() + 60_000) },
    "user-b",
  );

  assert.equal(access.ok, false);
  assert.equal(access.error, "SCAN_NOT_FOUND");
  assert.equal(access.status, 404);
});

test("rejects expired Outlook scans", () => {
  const access = validateOutlookScanAccess(
    { userId: "user-a", status: "pending", expiresAt: new Date(Date.now() - 60_000) },
    "user-a",
  );

  assert.equal(access.ok, false);
  assert.equal(access.error, "SCAN_EXPIRED");
  assert.equal(access.status, 410);
});

test("prevents replaying an already imported scan", () => {
  const access = validateOutlookScanAccess(
    { userId: "user-a", status: "imported", expiresAt: new Date(Date.now() + 60_000) },
    "user-a",
  );

  assert.equal(access.ok, false);
  assert.equal(access.error, "IMPORT_CONFLICT");
  assert.equal(access.status, 409);
});

test("rejects invalid edited candidate values", () => {
  const validation = validateOutlookCandidateForImport(storedCandidate(), {
    id: "candidate-1",
    selected: true,
    name: "",
    price: "-12",
    currency: "BTC",
    billingInterval: "weekly",
    nextPayment: "22-06-2026",
    category: "other",
  });

  assert.equal(validation.ok, false);
  assert.ok(validation.errors.length >= 5);
});

test("matches selected candidates only against stored scan candidates", () => {
  const matches = matchSelectedOutlookCandidates([storedCandidate({ id: "stored" })], [
    { id: "stored", selected: true, name: "Spotify" },
    { id: "client-only", selected: true, name: "Fake service" },
    { id: "ignored", selected: false, name: "Ignored" },
  ]);

  assert.equal(matches.length, 2);
  assert.equal(matches[0].stored.id, "stored");
  assert.equal(matches[1].stored, null);
});

test("summarizes partial batch failures without failing the whole import", () => {
  const summary = summarizeOutlookImportResults([
    { ok: true },
    { ok: false },
  ]);

  assert.equal(summary.ok, true);
  assert.equal(summary.status, "partial_success");
  assert.equal(summary.scanStatus, "partial_failed");
  assert.equal(summary.importedCount, 1);
  assert.equal(summary.failedCount, 1);
});
