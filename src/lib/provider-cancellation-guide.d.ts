export type CancellationGuideMethod = "website" | "email" | "phone" | "app" | "manual" | "unknown";

export const cancellationGuideMethods: CancellationGuideMethod[];
export function validateCancellationGuideInput(input: unknown): {
  ok: boolean;
  errors: string[];
  value: Record<string, unknown>;
};
export function toPublicCancellationGuide(provider: Record<string, unknown>): {
  providerId: string;
  providerName: string;
  logoPath: string | null;
  method: CancellationGuideMethod;
  instructions: string[];
  requiredInformation: string[];
  confirmationExpected: string | null;
  officialUrl: string | null;
  lastVerifiedAt: Date | string | null;
} | null;
export function hasActiveCancellationGuide(provider: Record<string, unknown>): boolean;
export function getSafeProviderGuideUrl(provider: Record<string, unknown>): string | null;
export function validateSafeExternalUrl(value: unknown): string | null;
export function getCancellationGuideMethodLabel(method: unknown): string;
export function getCancellationGuideCoverage<T extends Record<string, unknown>>(
  providers: T[],
  now?: Date,
): { withCompleteGuides: T[]; missingGuides: T[]; missingLogos: T[]; staleGuides: T[] };
