export const analyticsEventNames: string[];
export const allowedAnalyticsPropertyKeys: Set<string>;
export function sanitizeAnalyticsProperties(properties?: Record<string, unknown>): Record<string, string | number | boolean | null | undefined>;
export function getAnalyticsRuntimeConfig(env?: Record<string, string | undefined>): {
  enabled: boolean;
  posthogKey: string;
  posthogHost: string;
  consentRequired: boolean;
  environment: string;
};
export function hasAnalyticsConsent(storage?: Storage | null): boolean;
export function shouldBlockSessionRecording(pathname?: string): boolean;
export function createDedupeKey(eventName: string, properties?: Record<string, unknown>): string;
export function createAnalyticsDedupeStore(): {
  shouldTrack(eventName: string, properties?: Record<string, unknown>): boolean;
  reset(): void;
};
