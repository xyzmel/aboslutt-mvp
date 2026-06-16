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
    priceLabel: "29 kr/mnd",
    amountNok: 29,
    interval: "month",
    features: [
      "Ubegrensede abonnementer",
      "Gmail- og e-postskanning",
      "E-postvarsler",
      "Månedlig oppsummering",
      "Oppsigelsesassistent",
    ],
  },
  premiumYearlyBeta: {
    id: "premium_yearly_beta",
    name: "Premium årlig beta",
    priceLabel: "99 kr/år",
    amountNok: 99,
    interval: "year",
    badge: "Beta/early price",
    features: [
      "Alt i Premium månedlig",
      "Beta/early price for første år",
      "Leverandørspesifikk oppsigelsesveiledning",
    ],
  },
} as const;

export type CheckoutPlanId = "premium_monthly" | "premium_yearly_beta";

export function isCheckoutPlanId(value: string): value is CheckoutPlanId {
  return value === billingPlans.premiumMonthly.id || value === billingPlans.premiumYearlyBeta.id;
}

export function getCheckoutPlan(value: CheckoutPlanId) {
  return value === "premium_monthly" ? billingPlans.premiumMonthly : billingPlans.premiumYearlyBeta;
}
