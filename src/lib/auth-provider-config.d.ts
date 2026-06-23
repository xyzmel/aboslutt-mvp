export const microsoftLoginProviderId: "microsoft-login";
export const microsoftCommonWellKnownUrl: string;
export const microsoftLoginScope: string;
export const gmailReadonlyScope: string;

export function isGoogleMailConnectEnabled(env?: NodeJS.ProcessEnv): boolean;
export function getGoogleAuthScope(options?: { mailConnectEnabled?: boolean }): string;
export function isMicrosoftLoginConfigured(env?: NodeJS.ProcessEnv): boolean;
export function getMicrosoftLoginRedirectUri(baseUrl: string): string;
export function getSafeAuthErrorMessage(errorCode: string): string;
export function getProviderTokenPurpose(provider: string): "login" | "mailbox_import" | "login_and_mailbox_import";
export function canUseProviderForOutlookImport(provider: string, scope?: string): boolean;
