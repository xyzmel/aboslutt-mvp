export const billingPlans = {
  free: {
    id: "free",
    name: "Gratis",
    priceLabel: "0 kr",
    amountNok: 0,
    interval: null,
    features: [
      "Opptil 10 manuelle abonnementer",
      "Månedlig og årlig oversikt",
      "Grunnleggende dashboard",
    ],
  },
  premiumMonthly: {
    id: "premium_monthly",
    name: "Premium månedlig",
    priceLabel: "79 kr/mnd",
    amountNok: 79,
    interval: "month",
    features: [
      "Ubegrensede abonnementer",
      "Gmail- og e-postskanning",
      "E-postvarsler",
      "Månedlig oppsummering",
      "Oppsigelsesassistent",
    ],
  },
  premiumYearly: {
    id: "premium_yearly",
    name: "Premium årlig",
    priceLabel: "499 kr/år",
    amountNok: 499,
    interval: "year",
    features: [
      "Alt i Premium månedlig",
      "Årspris for lavere månedspris",
      "Leverandørspesifikk oppsigelsesveiledning",
    ],
  },
} as const;

export type CheckoutPlanId = "premium_monthly" | "premium_yearly";

export function isCheckoutPlanId(value: string): value is CheckoutPlanId {
  return value === billingPlans.premiumMonthly.id || value === billingPlans.premiumYearly.id;
}

export function getCheckoutPlan(value: CheckoutPlanId) {
  return value === "premium_monthly" ? billingPlans.premiumMonthly : billingPlans.premiumYearly;
}
