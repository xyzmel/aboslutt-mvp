import type { del, put } from "@vercel/blob";

export function isProviderLogoBlobConfigured(): boolean;
export function uploadProviderLogo(input: {
  slug: string;
  filename: string;
  contentType: string;
  data: Buffer;
  client?: { put: typeof put };
}): ReturnType<typeof put>;
export function deleteProviderLogoBlob(
  url: string | null | undefined,
  client?: { del: typeof del },
): Promise<boolean>;
export function isManagedProviderLogoBlob(value: unknown): boolean;
export function extensionForContentType(contentType: string): string;
