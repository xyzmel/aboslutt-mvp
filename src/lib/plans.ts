export const plans = ["free", "beta", "premium", "admin"] as const;

export type Plan = (typeof plans)[number];

const freeManualSubscriptionLimit = 10;

type PlanLikeUser = {
  plan?: string | null;
};

export function getUserPlan(user: PlanLikeUser | null | undefined): Plan {
  return normalizePlan(user?.plan);
}

export function normalizePlan(plan: string | null | undefined): Plan {
  if (plans.includes(plan as Plan)) {
    return plan as Plan;
  }

  return "free";
}

export function isValidPlan(plan: string): plan is Plan {
  return plans.includes(plan as Plan);
}

export function canUseGmailScan(user: PlanLikeUser) {
  return hasBetaEntitlements(getUserPlan(user));
}

export function canUseEmailReminders(user: PlanLikeUser) {
  return hasBetaEntitlements(getUserPlan(user));
}

export function canUseMonthlySummary(user: PlanLikeUser) {
  return hasBetaEntitlements(getUserPlan(user));
}

export function canSendCancellationEmail(user: PlanLikeUser) {
  return hasBetaEntitlements(getUserPlan(user));
}

export function canAddManualSubscription(user: PlanLikeUser, currentSubscriptionCount: number) {
  if (hasBetaEntitlements(getUserPlan(user))) {
    return true;
  }

  return currentSubscriptionCount < freeManualSubscriptionLimit;
}

export function getManualSubscriptionLimit(user: PlanLikeUser) {
  return hasBetaEntitlements(getUserPlan(user)) ? null : freeManualSubscriptionLimit;
}

export function getPlanDisplayName(plan: Plan) {
  const labels: Record<Plan, string> = {
    free: "Gratis",
    beta: "Premium",
    premium: "Premium",
    admin: "Admin",
  };

  return labels[plan];
}

export function getPlanFeatures(plan: Plan) {
  if (plan === "free") {
    return {
      included: [
        "Opptil 10 manuelle abonnementer",
        "Månedlig og årlig oversikt",
        "Grunnleggende dashboard",
      ],
      locked: ["Automatisk Gmail-skanning", "E-postvarsler", "Månedlig oppsummering", "Oppsigelseshjelp"],
    };
  }

  return {
    included: [
      "Ubegrensede abonnementer",
      "Automatisk Gmail-skanning",
      "E-postvarsler",
      "Månedlig oppsummering",
      "Oppsigelseshjelp",
    ],
    locked: [] as string[],
  };
}

function hasBetaEntitlements(plan: Plan) {
  return plan === "beta" || plan === "premium" || plan === "admin";
}
