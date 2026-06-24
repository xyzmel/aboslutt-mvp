import assert from "node:assert/strict";
import test from "node:test";
import {
  importProviderLogo,
  isBlockedAddress,
  MAX_ICON_BYTES,
  parseIconCandidates,
  validateIconResponse,
  validatePublicHttpUrl,
  validateRedirectTarget,
  validateRelatedIconUrl,
} from "../src/lib/provider-logo-importer.mjs";

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

test("SSRF protection rejects private hosts and addresses", () => {
  assert.throws(() => validatePublicHttpUrl("http://127.0.0.1/icon.png"), { code: "SSRF_BLOCKED" });
  assert.throws(() => validatePublicHttpUrl("http://localhost/icon.png"), { code: "SSRF_BLOCKED" });
  assert.equal(isBlockedAddress("10.0.0.1"), true);
  assert.equal(isBlockedAddress("169.254.169.254"), true);
  assert.equal(isBlockedAddress("8.8.8.8"), false);
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

test("icon discovery prefers the largest icon and ignores og:image", () => {
  const candidates = parseIconCandidates(`
    <meta property="og:image" content="/social.png">
    <link rel="icon" sizes="16x16" href="/small.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/touch.png">
    <link rel="icon" sizes="512x512" href="/large.png">
  `, "https://provider.example");
  assert.equal(candidates[0].url.pathname, "/large.png");
  assert.equal(candidates.some((candidate) => candidate.url.pathname === "/social.png"), false);
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
