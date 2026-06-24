import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getCancellationSendingCapability,
  getRecommendedCancellationMode,
  isRecentAuthentication,
  normalizeCancellationMode,
} from "../src/lib/cancellation-sending.mjs";
import { validateCancellationGuideInput } from "../src/lib/provider-cancellation-guide.mjs";

const now = new Date("2026-06-24T12:00:00.000Z");
const verifiedProvider = {
  id: "provider-1",
  isActive: true,
  isCancellationGuideActive: true,
  supportsAbosluttSending: true,
  verifiedCancellationEmail: "cancel@example.no",
  sendingVerifiedAt: "2026-06-01T00:00:00.000Z",
  cancellationMethod: "email",
};

test("Aboslutt sending requires a current verified provider recipient", () => {
  assert.deepEqual(getCancellationSendingCapability(verifiedProvider, now), {
    allowed: true,
    recipient: "cancel@example.no",
    verifiedAt: new Date("2026-06-01T00:00:00.000Z"),
  });
  assert.equal(getCancellationSendingCapability({ ...verifiedProvider, sendingVerifiedAt: "2025-01-01" }, now).allowed, false);
  assert.equal(getCancellationSendingCapability({ ...verifiedProvider, supportsAbosluttSending: false }, now).allowed, false);
  assert.equal(getCancellationSendingCapability({ ...verifiedProvider, verifiedCancellationEmail: "invalid" }, now).allowed, false);
});

test("all three cancellation modes resolve predictably", () => {
  assert.equal(getRecommendedCancellationMode(verifiedProvider, now), "aboslutt_email");
  assert.equal(getRecommendedCancellationMode({
    isActive: true,
    isCancellationGuideActive: true,
    cancellationMethod: "website",
    cancellationUrl: "https://example.no/account",
  }, now), "provider_portal");
  assert.equal(getRecommendedCancellationMode(null, now), "manual_draft");
  assert.equal(normalizeCancellationMode("aboslutt_email"), "aboslutt_email");
  assert.equal(normalizeCancellationMode("provider_portal"), "provider_portal");
  assert.equal(normalizeCancellationMode("manual_draft"), "manual_draft");
  assert.equal(normalizeCancellationMode("email"), "manual_draft");
});

test("sending requires recent authentication", () => {
  assert.equal(isRecentAuthentication(now.getTime() - 5 * 60_000, now.getTime()), true);
  assert.equal(isRecentAuthentication(now.getTime() - 20 * 60_000, now.getTime()), false);
  assert.equal(isRecentAuthentication(null, now.getTime()), false);
});

test("admin capability validation requires a verified address and date", () => {
  assert.equal(validateCancellationGuideInput({
    cancellationMethod: "email",
    cancellationInstructions: ["Send oppsigelsen."],
    isCancellationGuideActive: true,
    supportsAbosluttSending: true,
    verifiedCancellationEmail: "cancel@example.no",
    sendingVerifiedAt: "2026-06-01",
  }).ok, true);
  assert.equal(validateCancellationGuideInput({
    cancellationMethod: "email",
    cancellationInstructions: ["Send oppsigelsen."],
    isCancellationGuideActive: true,
    supportsAbosluttSending: true,
  }).ok, false);
});

test("server route enforces authorization, duplicate prevention, fixed sender, and delivery failure", async () => {
  const route = await readFile(new URL("../src/app/api/subscriptions/[id]/cancellation/route.ts", import.meta.url), "utf8");
  assert.match(route, /!authorizationConfirmed/);
  assert.match(route, /isRecentAuthentication/);
  assert.match(route, /cancellationDelivery\.create/);
  assert.match(route, /Aboslutt Oppsigelse <oppsigelse@aboslutt\.no>/);
  assert.match(route, /to: capability\.recipient/);
  assert.match(route, /deliveryStatus: "failed"/);
  assert.match(route, /error: "ALREADY_SENT"/);
  assert.doesNotMatch(route, /to: cancellationRequest\.recipientEmail/);
});

test("sending never completes the subscription without explicit confirmation", async () => {
  const route = await readFile(new URL("../src/app/api/subscriptions/[id]/cancellation/route.ts", import.meta.url), "utf8");
  const sendStart = route.indexOf("async function sendCancellationEmail");
  const statusStart = route.indexOf('if (action === "status")');
  const sendSection = route.slice(sendStart, route.indexOf("type ProviderSendingView"));
  assert.match(sendSection, /status: "awaiting_confirmation"/);
  assert.doesNotMatch(sendSection, /data: \{ status: "cancelled" \}/);
  assert.match(route.slice(statusStart, sendStart), /status === "confirmed_cancelled"/);
  assert.match(route.slice(statusStart, sendStart), /data: \{ status: "cancelled" \}/);
});

test("follow-up controls are rendered only in step three", async () => {
  const component = await readFile(new URL("../src/components/cancellation/CancellationEmailClient.tsx", import.meta.url), "utf8");
  assert.match(component, /step === 3 && request/);
  assert.match(component, /Bekreft avsluttet/);
  assert.match(component, /Last ned dokumentasjon/);
});
