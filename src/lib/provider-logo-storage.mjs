import { del, put } from "@vercel/blob";

const blobHostnameSuffix = ".public.blob.vercel-storage.com";

export function isProviderLogoBlobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export async function uploadProviderLogo({
  slug,
  filename,
  contentType,
  data,
  client = { put },
}) {
  if (!isProviderLogoBlobConfigured()) {
    throw new Error("BLOB_NOT_CONFIGURED");
  }

  return client.put(`providers/${sanitizeSegment(slug)}/${Date.now()}-${sanitizeFilename(filename)}`, data, {
    access: "public",
    addRandomSuffix: true,
    contentType,
    cacheControlMaxAge: 31_536_000,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
}

export async function deleteProviderLogoBlob(
  url,
  client = { del },
) {
  if (!url || !isManagedProviderLogoBlob(url) || !isProviderLogoBlobConfigured()) {
    return false;
  }
  await client.del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
  return true;
}

export function isManagedProviderLogoBlob(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname.endsWith(blobHostnameSuffix) &&
      url.pathname.startsWith("/providers/");
  } catch {
    return false;
  }
}

export function extensionForContentType(contentType) {
  return {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/x-icon": "ico",
  }[contentType] ?? "bin";
}

function sanitizeSegment(value) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "provider";
}

function sanitizeFilename(value) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+/, "") || "logo.bin";
}
