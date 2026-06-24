import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";

export const MAX_ICON_BYTES = 1024 * 1024;
export const MAX_HTML_BYTES = 512 * 1024;
export const MAX_REDIRECTS = 3;
export const REQUEST_TIMEOUT_MS = 7000;

const supportedTypes = new Map([
  ["image/png", "image/png"],
  ["image/jpeg", "image/jpeg"],
  ["image/jpg", "image/jpeg"],
  ["image/webp", "image/webp"],
  ["image/x-icon", "image/x-icon"],
  ["image/vnd.microsoft.icon", "image/x-icon"],
]);

export class ProviderLogoImportError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProviderLogoImportError";
    this.code = code;
  }
}

export async function importProviderLogo(websiteUrl, options = {}) {
  const request = options.request ?? secureRequest;
  const website = validatePublicHttpUrl(websiteUrl);
  const page = await request(website, {
    accept: "text/html",
    maxBytes: MAX_HTML_BYTES,
    originalHost: website.hostname,
    timeoutMs: options.timeoutMs,
  });
  const pageType = normalizeContentType(page.headers["content-type"]);
  if (pageType !== "text/html" && pageType !== "application/xhtml+xml") {
    throw new ProviderLogoImportError("INVALID_HTML", "Nettsiden returnerte ikke HTML.");
  }

  const candidates = parseIconCandidates(page.body.toString("utf8"), page.url);
  if (candidates.length === 0) {
    throw new ProviderLogoImportError("NO_ICONS", "Fant ingen egnede ikonlenker.");
  }

  let lastError = null;
  for (const candidate of candidates) {
    try {
      const iconUrl = validateRelatedIconUrl(candidate.url, website.hostname);
      const icon = await request(iconUrl, {
        accept: "image/png,image/jpeg,image/webp,image/x-icon",
        maxBytes: MAX_ICON_BYTES,
        originalHost: website.hostname,
        timeoutMs: options.timeoutMs,
      });
      const contentType = validateIconResponse(icon.headers["content-type"], icon.body);
      return {
        sourceUrl: icon.url.toString(),
        contentType,
        byteSize: icon.body.length,
        data: icon.body,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof ProviderLogoImportError
    ? lastError
    : new ProviderLogoImportError("NO_VALID_ICON", "Fant ingen gyldige ikoner.");
}

export function parseIconCandidates(html, baseUrl) {
  const candidates = [];
  for (const tag of String(html).match(/<link\b[^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag);
    const rel = (attributes.rel ?? "").toLowerCase().split(/\s+/);
    if (!rel.includes("icon") && !rel.includes("apple-touch-icon")) continue;
    if (!attributes.href) continue;
    try {
      const url = new URL(attributes.href, baseUrl);
      const size = getIconSize(attributes.sizes, rel.includes("apple-touch-icon"));
      candidates.push({ url, size, apple: rel.includes("apple-touch-icon") });
    } catch {
      // Ignore malformed icon references.
    }
  }
  return candidates.sort((a, b) => b.size - a.size || Number(b.apple) - Number(a.apple));
}

export function validatePublicHttpUrl(value) {
  let url;
  try {
    url = value instanceof URL ? new URL(value) : new URL(String(value));
  } catch {
    throw new ProviderLogoImportError("INVALID_URL", "Ugyldig nettadresse.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new ProviderLogoImportError("UNSUPPORTED_PROTOCOL", "Kun HTTP og HTTPS er tillatt.");
  }
  if (url.username || url.password || !url.hostname) {
    throw new ProviderLogoImportError("INVALID_URL", "Nettadressen kan ikke inneholde innlogging.");
  }
  if (isBlockedHostname(url.hostname)) {
    throw new ProviderLogoImportError("SSRF_BLOCKED", "Nettadressen er ikke offentlig.");
  }
  return url;
}

export function validateRelatedIconUrl(value, officialHost) {
  const url = validatePublicHttpUrl(value);
  if (!areRelatedHosts(url.hostname, officialHost)) {
    throw new ProviderLogoImportError("UNRELATED_DOMAIN", "Ikonet ligger på et annet domene.");
  }
  return url;
}

export function validateRedirectTarget(location, currentUrl, officialHost, redirectCount) {
  if (redirectCount >= MAX_REDIRECTS) {
    throw new ProviderLogoImportError("TOO_MANY_REDIRECTS", "For mange omdirigeringer.");
  }
  return validateRelatedIconUrl(new URL(location, currentUrl), officialHost);
}

export function validateIconResponse(contentTypeHeader, body) {
  if (body.length > MAX_ICON_BYTES) {
    throw new ProviderLogoImportError("FILE_TOO_LARGE", "Ikonfilen er for stor.");
  }
  const declared = supportedTypes.get(normalizeContentType(contentTypeHeader));
  const detected = detectImageType(body);
  if (!declared || !detected || declared !== detected) {
    throw new ProviderLogoImportError("INVALID_CONTENT_TYPE", "Filen er ikke et støttet bilde.");
  }
  return detected;
}

export function isBlockedAddress(address) {
  if (net.isIPv4(address)) {
    const parts = address.split(".").map(Number);
    return (
      parts[0] === 0 ||
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 192 && parts[1] === 0 && parts[2] === 0) ||
      (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) ||
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
      (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) ||
      (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) ||
      (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) ||
      parts[0] >= 224
    );
  }
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb") ||
      normalized.startsWith("ff") ||
      normalized.startsWith("2001:db8:") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.") ||
      normalized.startsWith("::ffff:169.254.")
    );
  }
  return true;
}

export async function secureRequest(urlValue, options = {}) {
  const url = validatePublicHttpUrl(urlValue);
  const originalHost = options.originalHost ?? url.hostname;
  const redirects = options.redirects ?? 0;
  if (!areRelatedHosts(url.hostname, originalHost)) {
    throw new ProviderLogoImportError("UNRELATED_DOMAIN", "Omdirigering til et annet domene ble avvist.");
  }

  const addresses = await (options.resolve ?? resolvePublicAddresses)(url.hostname);
  const address = addresses[0];
  const transport = url.protocol === "https:" ? https : http;
  const response = await new Promise((resolve, reject) => {
    const request = transport.request(url, {
      headers: {
        Accept: options.accept ?? "*/*",
        "User-Agent": "AbosluttProviderLogoImporter/1.0",
      },
      lookup: (_hostname, _lookupOptions, callback) => callback(null, address.address, address.family),
      servername: url.hostname,
      timeout: options.timeoutMs ?? REQUEST_TIMEOUT_MS,
    }, resolve);
    request.once("timeout", () => request.destroy(new ProviderLogoImportError("TIMEOUT", "Forespørselen tok for lang tid.")));
    request.once("error", reject);
    request.end();
  });

  if (isRedirect(response.statusCode)) {
    response.resume();
    const location = response.headers.location;
    if (!location) throw new ProviderLogoImportError("INVALID_REDIRECT", "Omdirigeringen mangler mål.");
    const nextUrl = validateRedirectTarget(location, url, originalHost, redirects);
    return secureRequest(nextUrl, { ...options, redirects: redirects + 1, originalHost });
  }
  if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
    response.resume();
    throw new ProviderLogoImportError("UPSTREAM_ERROR", "Nettstedet svarte ikke med en gyldig fil.");
  }

  const body = await readLimitedBody(response, options.maxBytes ?? MAX_ICON_BYTES);
  return { url, headers: response.headers, body };
}

async function resolvePublicAddresses(hostname) {
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((entry) => isBlockedAddress(entry.address))) {
    throw new ProviderLogoImportError("SSRF_BLOCKED", "Domenet peker til en privat eller reservert adresse.");
  }
  return addresses;
}

function readLimitedBody(response, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    response.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        response.destroy();
        reject(new ProviderLogoImportError("FILE_TOO_LARGE", "Responsen er for stor."));
        return;
      }
      chunks.push(chunk);
    });
    response.once("end", () => resolve(Buffer.concat(chunks)));
    response.once("error", reject);
  });
}

function parseAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attributes;
}

function getIconSize(sizes, apple) {
  const values = String(sizes ?? "").match(/\d+x\d+/gi) ?? [];
  const largest = Math.max(0, ...values.map((value) => Number(value.split("x")[0])));
  return largest || (apple ? 180 : 16);
}

function detectImageType(body) {
  if (body.length >= 8 && body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return "image/jpeg";
  if (body.length >= 12 && body.toString("ascii", 0, 4) === "RIFF" && body.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (body.length >= 4 && body[0] === 0 && body[1] === 0 && body[2] === 1 && body[3] === 0) return "image/x-icon";
  return null;
}

function normalizeContentType(value) {
  return String(value ?? "").split(";")[0].trim().toLowerCase();
}

function areRelatedHosts(left, right) {
  const a = left.toLowerCase().replace(/^www\./, "");
  const b = right.toLowerCase().replace(/^www\./, "");
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

function isBlockedHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    net.isIP(normalized) && isBlockedAddress(normalized)
  );
}

function isRedirect(status) {
  return [301, 302, 303, 307, 308].includes(status);
}
