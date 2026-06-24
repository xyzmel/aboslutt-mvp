export const cancellationAuthorizationVersion: string;
export const cancellationSendingModes: string[];
export const sendingVerificationMaxAgeMs: number;
export const recentAuthenticationMaxAgeMs: number;
export function getCancellationSendingCapability(
  provider: Record<string, unknown> | null | undefined,
  now?: Date,
):
  | { allowed: true; recipient: string; verifiedAt: Date }
  | { allowed: false; reason: string };
export function getRecommendedCancellationMode(
  provider: Record<string, unknown> | null | undefined,
  now?: Date,
): "aboslutt_email" | "provider_portal" | "manual_draft";
export function isRecentAuthentication(authenticatedAt: number | string | Date | null | undefined, now?: number): boolean;
export function normalizeCancellationMode(value: unknown): "aboslutt_email" | "provider_portal" | "manual_draft";
