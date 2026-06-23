export type NormalizedSubscriptionStatus =
  | "active"
  | "pending"
  | "cancellation_scheduled"
  | "cancelled"
  | "expired"
  | "none";

export type NormalizedBillingInterval = "monthly" | "yearly" | null;

export type BillingAgreementForDisplay = {
  plan: string;
  status: string;
  priceNok: number;
  interval: string;
  currency: string;
  activatedAt: string | null;
  cancelledAt: string | null;
  expiresAt: string | null;
};

export type NormalizedSettingsBillingState = {
  currentPlan: "free" | "premium";
  entitlementActive: boolean;
  subscriptionStatus: NormalizedSubscriptionStatus;
  price: number | null;
  currency: string | null;
  billingInterval: NormalizedBillingInterval;
  activatedAt: string | null;
  expiresAt: string | null;
  historicalAgreement: BillingAgreementForDisplay | null;
};

export function normalizeSettingsBillingState(input: {
  plan: string | null | undefined;
  agreement: BillingAgreementForDisplay | null;
}): NormalizedSettingsBillingState;

export function normalizeBillingInterval(interval: string | null | undefined): NormalizedBillingInterval;
