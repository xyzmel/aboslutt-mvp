import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  importProviderLogo,
  fetchProviderLogoSource,
  isBlockedAddress,
  MAX_ICON_BYTES,
  parseIconCandidates,
  secureRequest,
  validateIconResponse,
  validatePublicHttpUrl,
  validateRedirectTarget,
  validateRelatedIconUrl,
} from "../src/lib/provider-logo-importer.mjs";
import {
  deleteProviderLogoBlob,
  isManagedProviderLogoBlob,
  uploadProviderLogo,
} from "../src/lib/provider-logo-storage.mjs";

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

test("SSRF protection rejects private hosts and addresses", () => {
  assert.throws(() => validatePublicHttpUrl("https://127.0.0.1/icon.png"), { code: "SSRF_BLOCKED" });
  assert.throws(() => validatePublicHttpUrl("https://localhost/icon.png"), { code: "SSRF_BLOCKED" });
  assert.equal(isBlockedAddress("10.0.0.1"), true);
  assert.equal(isBlockedAddress("169.254.169.254"), true);
  assert.equal(isBlockedAddress("8.8.8.8"), false);
});

test("DNS resolution to a private address is rejected before connecting", async () => {
  await assert.rejects(
    secureRequest("https://provider.example/icon.png", {
      resolve: async () => [{ address: "10.0.0.8", family: 4 }],
    }),
    { code: "SSRF_BLOCKED" },
  );
});

test("unsupported protocols and credential URLs are rejected", () => {
  assert.throws(() => validatePublicHttpUrl("file:///etc/passwd"), { code: "UNSUPPORTED_PROTOCOL" });
  assert.throws(() => validatePublicHttpUrl("https://user:pass@example.com/icon.png"), { code: "INVALID_URL" });
});

test("unrelated redirects and excessive redirect chains are rejected", () => {
  assert.throws(
    () => validateRedirectTarget("https://evil.example/icon.png", "https://provider.example/", "provider.example", 0),
    { code: "UNRELATED_DOMAIN" },
  );
  assert.throws(
    () => validateRedirectTarget("/icon.png", "https://provider.example/", "provider.example", 3),
    { code: "TOO_MANY_REDIRECTS" },
  );
  assert.equal(
    validateRedirectTarget("https://www.provider.example/icon.png", "https://provider.example/", "provider.example", 0).hostname,
    "www.provider.example",
  );
});

test("invalid content types, SVG, HTML, and oversized files are rejected", () => {
  assert.throws(() => validateIconResponse("image/svg+xml", Buffer.from("<svg></svg>")), { code: "INVALID_CONTENT_TYPE" });
  assert.throws(() => validateIconResponse("text/html", Buffer.from("<html></html>")), { code: "INVALID_CONTENT_TYPE" });
  assert.throws(() => validateIconResponse("image/png", Buffer.alloc(MAX_ICON_BYTES + 1)), { code: "FILE_TOO_LARGE" });
  assert.equal(validateIconResponse("image/png; charset=binary", png), "image/png");
});

test("icon discovery prefers a PNG apple-touch icon and ignores og:image", () => {
  const candidates = parseIconCandidates(`
    <meta property="og:image" content="/social.png">
    <link rel="icon" sizes="16x16" href="/small.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/touch.png">
    <link rel="icon" sizes="512x512" href="/large.png">
  `, "https://provider.example");
  assert.equal(candidates[0].url.pathname, "/touch.png");
  assert.equal(candidates.some((candidate) => candidate.url.pathname === "/social.png"), false);
});

test("relative icon URLs resolve against the official website", () => {
  const candidates = parseIconCandidates(
    '<link rel="shortcut icon" type="image/png" href="../assets/favicon.png">',
    "https://provider.example/account/",
  );
  assert.equal(candidates[0].url.toString(), "https://provider.example/assets/favicon.png");
});

test("ICO is preferred over JPEG when PNG and WebP are unavailable", () => {
  const candidates = parseIconCandidates(`
    <link rel="icon" type="image/jpeg" href="/logo.jpg">
    <link rel="shortcut icon" type="image/x-icon" href="/favicon.ico">
  `, "https://provider.example");
  assert.equal(candidates[0].url.pathname, "/favicon.ico");
});

test("missing icon markup returns a safe no-icons error", async () => {
  await assert.rejects(
    importProviderLogo("https://provider.example", {
      request: async () => ({
        url: new URL("https://provider.example"),
        headers: { "content-type": "text/html" },
        body: Buffer.from("<html><head></head></html>"),
      }),
    }),
    { code: "NO_ICONS" },
  );
});

test("oversized HTML is rejected", async () => {
  await assert.rejects(
    importProviderLogo("https://provider.example", {
      request: async () => {
        const error = new Error("too large");
        error.code = "FILE_TOO_LARGE";
        throw error;
      },
    }),
    { code: "FILE_TOO_LARGE" },
  );
});

test("a valid discovered icon is returned from the official domain", async () => {
  const calls = [];
  const result = await importProviderLogo("https://provider.example", {
    request: async (url) => {
      calls.push(url.toString());
      if (calls.length === 1) {
        return {
          url: new URL("https://provider.example"),
          headers: { "content-type": "text/html" },
          body: Buffer.from('<link rel="icon" sizes="128x128" href="/icon.png">'),
        };
      }
      validateRelatedIconUrl(url, "provider.example");
      return {
        url: new URL("https://provider.example/icon.png"),
        headers: { "content-type": "image/png" },
        body: png,
      };
    },
  });
  assert.equal(result.sourceUrl, "https://provider.example/icon.png");
  assert.equal(result.contentType, "image/png");
});

test("approval refetch validates the exact candidate URL again", async () => {
  const result = await fetchProviderLogoSource(
    "https://provider.example/icon.png",
    "https://provider.example",
    {
      request: async (url) => ({
        url,
        headers: { "content-type": "image/png" },
        body: png,
      }),
    },
  );
  assert.equal(result.sourceUrl, "https://provider.example/icon.png");
});

test("Blob upload uses a controlled provider pathname", async () => {
  const previousToken = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  let invocation;
  try {
    const result = await uploadProviderLogo({
      slug: "Test Provider",
      filename: "Logo.PNG",
      contentType: "image/png",
      data: png,
      client: {
        put: async (...args) => {
          invocation = args;
          return { url: "https://store.public.blob.vercel-storage.com/providers/test-provider/logo.png" };
        },
      },
    });
    assert.match(invocation[0], /^providers\/test-provider\/\d+-logo\.png$/);
    assert.equal(invocation[2].access, "public");
    assert.equal(result.url.includes("blob.vercel-storage.com"), true);
  } finally {
    process.env.BLOB_READ_WRITE_TOKEN = previousToken;
  }
});

test("Blob replacement deletes managed Blob URLs but never local logos", async () => {
  const previousToken = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  const deleted = [];
  try {
    assert.equal(isManagedProviderLogoBlob("/providers/netflix.png"), false);
    assert.equal(
      await deleteProviderLogoBlob("/providers/netflix.png", { del: async (value) => deleted.push(value) }),
      false,
    );
    const blobUrl = "https://store.public.blob.vercel-storage.com/providers/netflix/logo.png";
    assert.equal(
      await deleteProviderLogoBlob(blobUrl, { del: async (value) => deleted.push(value) }),
      true,
    );
    assert.deepEqual(deleted, [blobUrl]);
  } finally {
    process.env.BLOB_READ_WRITE_TOKEN = previousToken;
  }
});

test("approval and manual upload routes revalidate images before Blob persistence", async () => {
  const route = await readFile(
    new URL("../src/app/api/admin/subscription-providers/[id]/logo/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /fetchProviderLogoSource\(asset\.sourceUrl, provider\.websiteUrl\)/);
  assert.match(route, /validateIconResponse\(file\.type, data\)/);
  assert.match(route, /uploadProviderLogo/);
  assert.match(route, /deleteProviderLogoBlob\(provider\.logoPath\)/);
  assert.match(route, /isManagedProviderLogoBlob\(provider\.logoPath\)/);
  assert.doesNotMatch(route, /data:\s*imported\.data/);
});
