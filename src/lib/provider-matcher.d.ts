export type ProviderMatch = {
  providerId: string;
  canonicalName: string;
  matchType: "sender_domain" | "canonical_name" | "alias" | "sender_name" | "receipt_text";
  confidence: "high" | "medium";
  matchedValue: string;
  explanation: string;
  suggestedCategory: "streaming" | "software" | "news" | "health";
  logoPath: string | null;
};
export function matchSubscriptionProvider(input: Record<string, unknown>, providers: Record<string, unknown>[]): ProviderMatch | null;
export function buildProviderCandidate<T extends Record<string, unknown>>(candidate: T, match: ProviderMatch | null): T & Record<string, unknown>;
export function getLikelyDuplicateWarning(candidate: Record<string, unknown>, subscriptions: Record<string, unknown>[]): {
  likelyDuplicate: boolean;
  duplicateCount: number;
  duplicateMessage: string | null;
};
export function sanitizeUnmatchedProviderName(value: unknown): { displayName: string; normalizedName: string } | null;
