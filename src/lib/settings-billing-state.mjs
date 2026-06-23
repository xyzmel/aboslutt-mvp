export function normalizeSettingsBillingState({ plan, agreement }) {
  const entitlementActive = plan === "premium" || plan === "beta";
  const isCurrentPremium = entitlementActive;
  const activePremiumAgreement = isCurrentPremium && agreement ? agreement : null;
  const subscriptionStatus = normalizeSubscriptionStatus({ entitlementActive, agreement });

  if (!isCurrentPremium) {
    return {
      currentPlan: "free",
      entitlementActive: false,
      subscriptionStatus,
      price: null,
      currency: null,
      billingInterval: null,
      activatedAt: null,
      expiresAt: null,
      historicalAgreement: agreement ?? null,
    };
  }

  return {
    currentPlan: "premium",
    entitlementActive: true,
    subscriptionStatus,
    price: activePremiumAgreement?.priceNok ?? null,
    currency: activePremiumAgreement?.currency ?? null,
    billingInterval: normalizeBillingInterval(activePremiumAgreement?.interval),
    activatedAt: activePremiumAgreement?.activatedAt ?? null,
    expiresAt: activePremiumAgreement?.expiresAt ?? null,
    historicalAgreement: null,
  };
}

function normalizeSubscriptionStatus({ entitlementActive, agreement }) {
  if (!agreement) {
    return entitlementActive ? "active" : "none";
  }

  if (agreement.status === "active") {
    return entitlementActive ? "active" : "none";
  }

  if (agreement.status === "pending") {
    return "pending";
  }

  if (agreement.status === "cancellation_pending") {
    return entitlementActive ? "cancellation_scheduled" : "cancelled";
  }

  if (agreement.status === "cancelled" || agreement.status === "terminated" || agreement.status === "aborted") {
    return entitlementActive ? "cancellation_scheduled" : "cancelled";
  }

  if (agreement.status === "expired" || agreement.status === "failed") {
    return entitlementActive ? "pending" : "expired";
  }

  return entitlementActive ? "active" : "none";
}

export function normalizeBillingInterval(interval) {
  if (interval === "month" || interval === "monthly") {
    return "monthly";
  }

  if (interval === "year" || interval === "yearly") {
    return "yearly";
  }

  return null;
}
