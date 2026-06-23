export type AttemptedAuthProvider = "google" | "microsoft-login" | "vipps";

export const authAttemptCookieName: string;
export const authAttemptMaxAgeSeconds: number;
export function normalizeAttemptedProvider(value: unknown): AttemptedAuthProvider | null;
export function readAttemptedProvider(cookieString?: string): AttemptedAuthProvider | null;
export function createAttemptedProviderCookie(
  provider: AttemptedAuthProvider,
  options?: { secure?: boolean },
): string;
export function createClearedAttemptedProviderCookie(options?: { secure?: boolean }): string;
export function getAuthErrorPresentation(
  errorCode: string,
  attemptedProvider?: unknown,
): {
  provider: AttemptedAuthProvider | null;
  message: string;
  retryLabel: string;
};
