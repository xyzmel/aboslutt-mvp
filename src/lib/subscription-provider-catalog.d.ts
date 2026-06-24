export type CatalogProvider = {
  id?: string;
  name: string;
  slug: string;
  category: string;
  aliases: string[];
  senderNames: string[];
  emailDomains: string[];
  logoPath?: string | null;
  cancellationMethod?: string | null;
  cancellationInstructions?: string[];
  requiredInformation?: string[];
  confirmationExpected?: string | null;
  countryCode?: string | null;
  verificationSource?: string | null;
  isCancellationGuideActive?: boolean;
  defaultBillingInterval?: string | null;
  isActive?: boolean;
};

export function normalizeProviderSearchValue(value: unknown): string;
export function searchSubscriptionProviders<T extends CatalogProvider>(providers: T[], query: unknown, limit?: number): T[];
export function suggestSubscriptionCategory(category: string): "streaming" | "software" | "news" | "health";
export function getProviderInitials(name: unknown): string;
export function applyProviderSelectionToDraft<T extends Record<string, unknown>>(
  draft: T,
  provider: (CatalogProvider & { id: string; suggestedCategory?: string }) | null,
  dirtyFields?: {
    category?: boolean;
    billingInterval?: boolean;
    monthlyCost?: boolean;
    nextPayment?: boolean;
  },
): T & { providerId: string | null };
export function matchExistingSubscriptionProvider<T extends CatalogProvider>(
  subscriptionName: unknown,
  providers: T[],
): { status: "linked" | "unmatched" | "ambiguous"; provider: T | null; candidates: T[] };
export function validateProviderAdminInput(input: unknown): {
  ok: boolean;
  errors: string[];
  value: Record<string, unknown>;
};
