import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createSanitizedAuthAdapter,
  sanitizeAuthAccount,
} from "../src/lib/auth-account-sanitizer.mjs";
import {
  createAttemptedProviderCookie,
  createClearedAttemptedProviderCookie,
  getAuthErrorPresentation,
  readAttemptedProvider,
} from "../src/lib/auth-login-state.mjs";
import {
  redactSensitiveObject,
  redactSensitiveText,
} from "../src/lib/sensitive-data-redaction.mjs";

test("Microsoft token metadata is whitelisted before Prisma receives it", async () => {
  let received;
  const adapter = createSanitizedAuthAdapter({
    async linkAccount(account) {
      received = account;
      return account;
    },
  });

  await adapter.linkAccount({
    userId: "user-1",
    type: "oauth",
    provider: "microsoft-login",
    providerAccountId: "microsoft-1",
    access_token: "access-value",
    refresh_token: "refresh-value",
    expires_at: 123,
    token_type: "Bearer",
    scope: "openid profile email",
    id_token: "id-value",
    session_state: "session",
    ext_expires_in: 3600,
    provider_specific_unknown: "must-not-reach-prisma",
  });

  assert.equal(received.ext_expires_in, undefined);
  assert.equal(received.provider_specific_unknown, undefined);
  assert.equal(received.provider, "microsoft-login");
  assert.equal(received.access_token, "access-value");
  assert.equal(received.userId, "user-1");
});

test("supported custom Account fields remain available", () => {
  const account = sanitizeAuthAccount({
    provider: "microsoft",
    providerAccountId: "mailbox-1",
    providerEmail: "person@example.com",
    refresh_token_expires_in: 86400,
  });

  assert.equal(account.providerEmail, "person@example.com");
  assert.equal(account.refresh_token_expires_in, 86400);
});

test("existing user linking succeeds without colliding with Outlook mailbox credentials", async () => {
  const rows = [
    {
      userId: "user-1",
      provider: "microsoft",
      providerAccountId: "mailbox-1",
      providerEmail: "person@example.com",
    },
  ];
  const adapter = createSanitizedAuthAdapter({
    async linkAccount(account) {
      rows.push(account);
      return account;
    },
  });

  await adapter.linkAccount({
    userId: "user-1",
    type: "oauth",
    provider: "microsoft-login",
    providerAccountId: "login-1",
    ext_expires_in: 3600,
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].provider, "microsoft");
  assert.equal(rows[1].provider, "microsoft-login");
  assert.equal(rows[0].providerEmail, "person@example.com");
});

test("login completion is configured after adapter linking, not in the signIn callback", async () => {
  const authSource = await readFile(new URL("../src/lib/auth.ts", import.meta.url), "utf8");
  const callbacksBlock = authSource.slice(
    authSource.indexOf("callbacks:"),
    authSource.indexOf("events:"),
  );
  const eventsBlock = authSource.slice(authSource.indexOf("events:"));

  assert.doesNotMatch(callbacksBlock, /trackLoginCompleted/);
  assert.match(eventsBlock, /trackLoginCompleted/);

  let completed = false;
  const adapter = createSanitizedAuthAdapter({
    async linkAccount() {
      throw new Error("adapter failure");
    },
  });

  await assert.rejects(async () => {
    await adapter.linkAccount({
      userId: "user-1",
      type: "oauth",
      provider: "microsoft-login",
      providerAccountId: "login-1",
    });
    completed = true;
  });
  assert.equal(completed, false);
});

test("Microsoft failure shows Microsoft retry and never Google copy", () => {
  const microsoft = getAuthErrorPresentation("OAuthCallback", "microsoft-login");

  assert.equal(microsoft.message, "Vi klarte ikke å logge deg inn med Microsoft. Prøv igjen.");
  assert.equal(microsoft.retryLabel, "Prøv Microsoft på nytt");
  assert.doesNotMatch(microsoft.message + microsoft.retryLabel, /Google/);
});

test("Google failure shows Google retry", () => {
  const google = getAuthErrorPresentation("OAuthCallback", "google");

  assert.equal(google.message, "Vi klarte ikke å logge deg inn med Google. Prøv igjen.");
  assert.equal(google.retryLabel, "Prøv Google på nytt");
});

test("Vipps failure shows Vipps retry", () => {
  const vipps = getAuthErrorPresentation("OAuthCallback", "vipps");

  assert.equal(vipps.message, "Vi klarte ikke å logge deg inn med Vipps. Prøv igjen.");
  assert.equal(vipps.retryLabel, "Prøv Vipps på nytt");
});

test("unknown provider uses generic retry", () => {
  const unknown = getAuthErrorPresentation("OAuthCallback", "unknown");

  assert.equal(unknown.message, "Vi klarte ikke å logge deg inn. Prøv igjen.");
  assert.equal(unknown.retryLabel, "Prøv igjen");
});

test("attempted provider cookie is short-lived and can be cleared after success or error", () => {
  const cookie = createAttemptedProviderCookie("microsoft-login", { secure: true });
  assert.equal(readAttemptedProvider(cookie), "microsoft-login");
  assert.match(cookie, /Max-Age=300/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Secure/);
  assert.match(createClearedAttemptedProviderCookie(), /Max-Age=0/);
});

test("successful sign-in clears stale attempted-provider state", async () => {
  const analyticsProviderSource = await readFile(
    new URL("../src/components/analytics/AnalyticsProvider.tsx", import.meta.url),
    "utf8",
  );
  const loginScreenSource = await readFile(
    new URL("../src/components/auth/MagicLinkAuthScreen.tsx", import.meta.url),
    "utf8",
  );

  assert.match(analyticsProviderSource, /if \(userId\)[\s\S]*createClearedAttemptedProviderCookie/);
  assert.match(loginScreenSource, /createClearedAttemptedProviderCookie[\s\S]*clearAuthErrorFromUrl/);
});

test("token values are removed from production-safe log payloads", () => {
  const errorText =
    "OAuth failed access_token=secret-access refresh_token=secret-refresh Authorization: Bearer secret-bearer";
  const redactedText = redactSensitiveText(errorText);
  const payload = redactSensitiveObject({
    error: errorText,
    nested: { id_token: "secret-id", safe: "microsoft-login" },
  });

  assert.doesNotMatch(redactedText, /secret-access|secret-refresh|secret-bearer/);
  assert.equal(payload.nested.id_token, "[redacted]");
  assert.equal(payload.nested.safe, "microsoft-login");
  assert.doesNotMatch(payload.error, /secret-access|secret-refresh|secret-bearer/);
});
