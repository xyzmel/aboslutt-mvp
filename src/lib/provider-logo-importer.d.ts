export const MAX_ICON_BYTES: number;
export const MAX_HTML_BYTES: number;
export class ProviderLogoImportError extends Error {
  code: string;
}
export function importProviderLogo(
  websiteUrl: string,
  options?: {
    request?: (
      url: URL,
      options: Record<string, unknown>,
    ) => Promise<{ url: URL; headers: Record<string, string | string[] | undefined>; body: Buffer }>;
    timeoutMs?: number;
  },
): Promise<{ sourceUrl: string; contentType: string; byteSize: number; data: Buffer }>;
export function fetchProviderLogoSource(
  sourceUrl: string,
  websiteUrl: string,
  options?: {
    request?: (
      url: URL,
      options: Record<string, unknown>,
    ) => Promise<{ url: URL; headers: Record<string, string | string[] | undefined>; body: Buffer }>;
    timeoutMs?: number;
  },
): Promise<{ sourceUrl: string; contentType: string; byteSize: number; data: Buffer }>;
export function parseIconCandidates(html: string, baseUrl: URL | string): Array<{ url: URL; size: number; apple: boolean; declaredType: string; rank: number }>;
export function validatePublicHttpUrl(value: unknown): URL;
export function validateRelatedIconUrl(value: unknown, officialHost: string): URL;
export function validateRedirectTarget(location: string, currentUrl: URL | string, officialHost: string, redirectCount: number): URL;
export function validateIconResponse(contentType: unknown, body: Buffer): string;
export function getImageDimensions(body: Buffer, contentType: string): { width: number; height: number } | null;
export function isBlockedAddress(address: string): boolean;
export function secureRequest(
  url: URL | string,
  options?: Record<string, unknown>,
): Promise<{ url: URL; headers: Record<string, string | string[] | undefined>; body: Buffer }>;
