import assert from "node:assert/strict";
import test from "node:test";
import { subscriptionProviderSeed } from "../src/data/subscription-providers.mjs";
import {
  applyProviderSelectionToDraft,
  getProviderInitials,
  matchExistingSubscriptionProvider,
  searchSubscriptionProviders,
  suggestSubscriptionCategory,
  validateProviderAdminInput,
} from "../src/lib/subscription-provider-catalog.mjs";
import {
  buildProviderCandidate,
  getLikelyDuplicateWarning,
  matchSubscriptionProvider,
  sanitizeUnmatchedProviderName,
} from "../src/lib/provider-matcher.mjs";
import { detectOutlookSubscriptionCandidates } from "../src/lib/microsoft-outlook-detector.mjs";
import {
  getCancellationGuideCoverage,
  toPublicCancellationGuide,
  validateCancellationGuideInput,
  validateSafeExternalUrl,
} from "../src/lib/provider-cancellation-guide.mjs";

const matchableProviders = subscriptionProviderSeed.map((provider) => ({ ...provider, id: provider.slug }));

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

test("provider selection preserves every manually edited suggestion field", () => {
  const draft = {
    providerId: null,
    name: "Eget valg",
    category: "health",
    billingInterval: "monthly",
    monthlyCost: "321",
    nextPayment: "2030-08-12",
  };
  const provider = {
    id: "yearly-news",
    name: "Yearly News",
    slug: "yearly-news",
    category: "news",
    suggestedCategory: "news",
    defaultBillingInterval: "yearly",
    aliases: [],
    senderNames: [],
    emailDomains: [],
  };
  const result = applyProviderSelectionToDraft(draft, provider, {
    category: true,
    billingInterval: true,
    monthlyCost: true,
    nextPayment: true,
  });
  assert.equal(result.category, "health");
  assert.equal(result.billingInterval, "monthly");
  assert.equal(result.monthlyCost, "321");
  assert.equal(result.nextPayment, "2030-08-12");
});

test("selecting another provider still preserves dirty fields", () => {
  const dirty = { category: true, billingInterval: true, monthlyCost: true, nextPayment: true };
  const draft = {
    providerId: null,
    name: "",
    category: "software",
    billingInterval: "yearly",
    monthlyCost: "499",
    nextPayment: "2030-01-01",
  };
  const first = applyProviderSelectionToDraft(draft, {
    id: "first",
    name: "First",
    slug: "first",
    category: "streaming",
    suggestedCategory: "streaming",
    defaultBillingInterval: "monthly",
    aliases: [],
    senderNames: [],
    emailDomains: [],
  }, dirty);
  const second = applyProviderSelectionToDraft(first, {
    id: "second",
    name: "Second",
    slug: "second",
    category: "news",
    suggestedCategory: "news",
    defaultBillingInterval: "monthly",
    aliases: [],
    senderNames: [],
    emailDomains: [],
  }, dirty);
  assert.equal(second.name, "Second");
  assert.equal(second.category, "software");
  assert.equal(second.billingInterval, "yearly");
  assert.equal(second.monthlyCost, "499");
  assert.equal(second.nextPayment, "2030-01-01");
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

test("known sender domain produces a high-confidence catalog match", () => {
  const match = matchSubscriptionProvider(
    { senderDomain: "netflix.com", receiptText: "Receipt NOK 169" },
    matchableProviders,
  );
  assert.equal(match?.canonicalName, "Netflix");
  assert.equal(match?.matchType, "sender_domain");
  assert.equal(match?.confidence, "high");
});

test("strong alias plus recurring evidence matches canonical provider", () => {
  const match = matchSubscriptionProvider(
    { providerName: "HBO Max", receiptText: "Abonnement fornyes månedlig NOK 129" },
    matchableProviders,
  );
  assert.equal(match?.canonicalName, "Max");
  assert.equal(match?.matchType, "alias");
});

test("known sender name with amount and interval produces medium confidence", () => {
  const match = matchSubscriptionProvider(
    { senderName: "Spotify", receiptText: "Receipt NOK 129 monthly" },
    matchableProviders,
  );
  assert.equal(match?.canonicalName, "Spotify");
  assert.equal(match?.matchType, "sender_name");
  assert.equal(match?.confidence, "medium");
});

test("canonical-name normalization matches punctuation and casing", () => {
  const match = matchSubscriptionProvider(
    { providerName: "  DISNEY plus ", receiptText: "Subscription renewal EUR 10 monthly" },
    matchableProviders,
  );
  assert.equal(match?.canonicalName, "Disney+");
});

test("payment intermediaries do not become providers from domain alone", () => {
  assert.equal(
    matchSubscriptionProvider(
      { senderDomain: "paypal.com", receiptText: "Receipt NOK 99 monthly" },
      matchableProviders,
    ),
    null,
  );
});

test("large retailer domains do not become providers without a real service match", () => {
  assert.equal(
    matchSubscriptionProvider(
      { senderDomain: "amazon.com", providerName: "Amazon", receiptText: "Order receipt NOK 499" },
      matchableProviders,
    ),
    null,
  );
});

test("Outlook accepts a real catalog service behind a broad retailer only with strong receipt evidence", () => {
  const message = {
    id: "prime-1",
    subject: "Prime Video subscription renewal",
    from: { emailAddress: { address: "receipt@amazon.com", name: "Amazon" } },
    receivedDateTime: "2026-06-24T10:00:00.000Z",
    bodyPreview: "Your monthly Prime Video subscription renewed. Total NOK 89. Next payment next month.",
    hasAttachments: false,
  };
  const match = matchSubscriptionProvider(
    {
      senderName: "Amazon",
      senderDomain: "amazon.com",
      receiptText: `${message.subject} ${message.bodyPreview}`,
    },
    matchableProviders,
  );
  assert.equal(match?.canonicalName, "Prime Video");
  const candidates = detectOutlookSubscriptionCandidates([message], { [message.id]: match });
  assert.equal(candidates[0]?.providerName, "Prime Video");
});

test("matched candidate exposes provider logo/category metadata but remains only a candidate", () => {
  const provider = { ...matchableProviders.find((item) => item.slug === "spotify"), logoPath: "/providers/spotify.png" };
  const match = matchSubscriptionProvider(
    { providerName: "Spotify", receiptText: "Subscription monthly NOK 129" },
    [provider],
  );
  const candidate = buildProviderCandidate(
    { merchantName: "SPOTIFY AB", amount: 129, billingInterval: "monthly" },
    match,
  );
  assert.equal(candidate.providerId, "spotify");
  assert.equal(candidate.merchantName, "Spotify");
  assert.equal(candidate.originalDetectedName, "SPOTIFY AB");
  assert.equal(candidate.providerLogoPath, "/providers/spotify.png");
  assert.equal(candidate.suggestedCategory, "streaming");
  assert.equal("subscriptionId" in candidate, false);
});

test("duplicate warning uses provider and interval but permits other intervals", () => {
  const sameInterval = getLikelyDuplicateWarning(
    { providerId: "spotify", billingInterval: "monthly", canonicalProviderName: "Spotify" },
    [{ providerId: "spotify", name: "Spotify Familie", billingInterval: "monthly", status: "active" }],
  );
  assert.equal(sameInterval.likelyDuplicate, true);

  const differentInterval = getLikelyDuplicateWarning(
    { providerId: "spotify", billingInterval: "yearly", canonicalProviderName: "Spotify" },
    [{ providerId: "spotify", name: "Spotify Familie", billingInterval: "monthly", status: "active" }],
  );
  assert.equal(differentInterval.likelyDuplicate, false);
  assert.match(differentInterval.duplicateMessage, /annet intervall/);
});

test("unmatched aggregation accepts only sanitized names", () => {
  assert.deepEqual(sanitizeUnmatchedProviderName("  Ukjent Tjeneste AS  "), {
    displayName: "Ukjent Tjeneste AS",
    normalizedName: "ukjent tjeneste as",
  });
  assert.equal(sanitizeUnmatchedProviderName("person@example.com"), null);
});

test("complete active provider guide is exposed without internal verification source", () => {
  const netflix = { ...subscriptionProviderSeed.find((provider) => provider.slug === "netflix"), id: "netflix" };
  const guide = toPublicCancellationGuide(netflix);
  assert.equal(guide?.providerName, "Netflix");
  assert.equal(guide?.method, "website");
  assert.ok(guide?.instructions.length > 0);
  assert.equal("verificationSource" in guide, false);
});

test("provider without guide and inactive guide use generic fallback", () => {
  const withoutGuide = { ...subscriptionProviderSeed.find((provider) => provider.slug === "max"), id: "max" };
  assert.equal(toPublicCancellationGuide(withoutGuide), null);
  assert.equal(toPublicCancellationGuide({
    ...withoutGuide,
    cancellationMethod: "website",
    cancellationInstructions: ["Åpne kontosiden."],
    isCancellationGuideActive: false,
  }), null);
});

test("unsafe provider URLs are rejected", () => {
  assert.equal(validateSafeExternalUrl("javascript:alert(1)"), null);
  assert.equal(validateSafeExternalUrl("data:text/html,hello"), null);
  const result = validateCancellationGuideInput({
    cancellationMethod: "website",
    cancellationInstructions: ["<b>Åpne</b> kontosiden."],
    isCancellationGuideActive: true,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.cancellationInstructions, ["Åpne kontosiden."]);
  const adminInput = validateProviderAdminInput({
    name: "Test",
    slug: "test",
    category: "other",
    cancellationUrl: "javascript:alert(1)",
  });
  assert.equal(adminInput.ok, false);
  assert.match(adminInput.errors.join(" "), /http- eller https-lenke/);
});

test("active guide requires concrete instructions while generic fallback remains valid", () => {
  assert.equal(validateCancellationGuideInput({
    cancellationMethod: "website",
    cancellationInstructions: [],
    isCancellationGuideActive: true,
  }).ok, false);
  assert.equal(validateCancellationGuideInput({
    cancellationMethod: "unknown",
    cancellationInstructions: [],
    isCancellationGuideActive: false,
  }).ok, true);
});

test("coverage reports stale guides after six months", () => {
  const coverage = getCancellationGuideCoverage([
    {
      id: "old",
      name: "Old Guide",
      isActive: true,
      isCancellationGuideActive: true,
      cancellationMethod: "website",
      cancellationInstructions: ["Åpne kontosiden."],
      lastVerifiedAt: "2025-01-01T00:00:00.000Z",
      logoPath: null,
    },
    {
      id: "missing",
      name: "Missing Guide",
      isActive: true,
      isCancellationGuideActive: false,
      cancellationInstructions: [],
      logoPath: "/providers/missing.svg",
    },
  ], new Date("2026-06-24T00:00:00.000Z"));
  assert.deepEqual(coverage.staleGuides.map((provider) => provider.id), ["old"]);
  assert.deepEqual(coverage.missingGuides.map((provider) => provider.id), ["missing"]);
  assert.deepEqual(coverage.missingLogos.map((provider) => provider.id), ["old"]);
});
