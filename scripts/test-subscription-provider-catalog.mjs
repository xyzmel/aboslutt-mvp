import assert from "node:assert/strict";
import test from "node:test";
import { subscriptionProviderSeed } from "../src/data/subscription-providers.mjs";
import {
  applyProviderSelectionToDraft,
  getProviderInitials,
  matchExistingSubscriptionProvider,
  searchSubscriptionProviders,
  suggestSubscriptionCategory,
} from "../src/lib/subscription-provider-catalog.mjs";

test("search finds canonical provider names", () => {
  assert.equal(searchSubscriptionProviders(subscriptionProviderSeed, "Netflix")[0]?.name, "Netflix");
});

test("search finds aliases", () => {
  assert.equal(searchSubscriptionProviders(subscriptionProviderSeed, "HBO Max")[0]?.name, "Max");
});

test("search finds email domains", () => {
  assert.equal(searchSubscriptionProviders(subscriptionProviderSeed, "spotify.com")[0]?.name, "Spotify");
});

test("custom provider selection preserves the typed name and stores no provider id", () => {
  const draft = { providerId: "old", name: "Min lokale klubb", monthlyCost: "499", nextPayment: "2030-01-01" };
  const result = applyProviderSelectionToDraft(draft, null);
  assert.equal(result.providerId, null);
  assert.equal(result.name, "Min lokale klubb");
});

test("provider selection suggests category and interval without overwriting price or date", () => {
  const draft = {
    providerId: null,
    name: "",
    category: "software",
    billingInterval: "yearly",
    monthlyCost: "499",
    nextPayment: "2030-01-01",
  };
  const result = applyProviderSelectionToDraft(draft, {
    id: "spotify",
    name: "Spotify",
    slug: "spotify",
    category: "music_audio",
    suggestedCategory: suggestSubscriptionCategory("music_audio"),
    defaultBillingInterval: "monthly",
    aliases: [],
    senderNames: [],
    emailDomains: [],
  });
  assert.equal(result.category, "streaming");
  assert.equal(result.billingInterval, "monthly");
  assert.equal(result.monthlyCost, "499");
  assert.equal(result.nextPayment, "2030-01-01");
});

test("missing logos use stable initials fallback", () => {
  assert.equal(getProviderInitials("PlayStation Plus"), "PP");
  assert.equal(getProviderInitials("Wolt+"), "WP");
});

test("existing subscriptions match only exact canonical names and aliases", () => {
  const match = matchExistingSubscriptionProvider("Adobe CC", subscriptionProviderSeed);
  assert.equal(match.status, "linked");
  assert.equal(match.provider?.name, "Adobe Creative Cloud");
  assert.equal(matchExistingSubscriptionProvider("Adobe annual invoice", subscriptionProviderSeed).status, "unmatched");
});

test("ambiguous aliases are never linked automatically", () => {
  const providers = [
    { ...subscriptionProviderSeed[0], name: "Alpha", aliases: ["Shared"] },
    { ...subscriptionProviderSeed[1], name: "Beta", aliases: ["Shared"] },
  ];
  const match = matchExistingSubscriptionProvider("Shared", providers);
  assert.equal(match.status, "ambiguous");
  assert.equal(match.provider, null);
  assert.equal(match.candidates.length, 2);
});
