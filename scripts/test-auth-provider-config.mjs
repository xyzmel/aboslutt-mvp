import assert from "node:assert/strict";
import test from "node:test";
import {
  canUseProviderForOutlookImport,
  getGoogleAuthScope,
  getMicrosoftLoginRedirectUri,
  getProviderTokenPurpose,
  getSafeAuthErrorMessage,
  isGoogleMailConnectEnabled,
  isMicrosoftLoginConfigured,
  microsoftCommonWellKnownUrl,
  microsoftLoginProviderId,
  microsoftLoginScope,
} from "../src/lib/auth-provider-config.mjs";

test("Gmail connection is disabled by default and removes mail scope from Google login", () => {
  assert.equal(isGoogleMailConnectEnabled({}), false);
  assert.equal(isGoogleMailConnectEnabled({ GOOGLE_MAIL_CONNECT_ENABLED: "false" }), false);
  assert.equal(getGoogleAuthScope({ mailConnectEnabled: false }), "openid email profile");
  assert.ok(!getGoogleAuthScope({ mailConnectEnabled: false }).includes("gmail.readonly"));
});

test("Gmail connection can be re-enabled explicitly", () => {
  assert.equal(isGoogleMailConnectEnabled({ GOOGLE_MAIL_CONNECT_ENABLED: "true" }), true);
  assert.ok(getGoogleAuthScope({ mailConnectEnabled: true }).includes("https://www.googleapis.com/auth/gmail.readonly"));
});

test("Microsoft login uses common authority and a separate provider id", () => {
  assert.equal(microsoftCommonWellKnownUrl, "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration");
  assert.equal(microsoftLoginProviderId, "microsoft-login");
  assert.equal(getMicrosoftLoginRedirectUri("https://www.aboslutt.no"), "https://www.aboslutt.no/api/auth/callback/microsoft-login");
  assert.equal(getMicrosoftLoginRedirectUri("http://localhost:3000/"), "http://localhost:3000/api/auth/callback/microsoft-login");
});

test("Microsoft login requests identity scopes only", () => {
  assert.equal(microsoftLoginScope, "openid profile email");
  assert.ok(!microsoftLoginScope.includes("Mail.Read"));
  assert.ok(!microsoftLoginScope.includes("Mail.Send"));
  assert.ok(!microsoftLoginScope.includes("Mail.ReadWrite"));
});

test("Microsoft login configuration requires only client id and secret", () => {
  assert.equal(isMicrosoftLoginConfigured({ MICROSOFT_CLIENT_ID: "id", MICROSOFT_CLIENT_SECRET: "secret" }), true);
  assert.equal(isMicrosoftLoginConfigured({ MICROSOFT_CLIENT_ID: "id" }), false);
});

test("Microsoft login and Outlook mailbox import token purposes stay separate", () => {
  assert.equal(getProviderTokenPurpose("microsoft-login"), "login");
  assert.equal(getProviderTokenPurpose("microsoft"), "mailbox_import");
  assert.equal(canUseProviderForOutlookImport("microsoft-login", "openid profile email"), false);
  assert.equal(canUseProviderForOutlookImport("microsoft", "User.Read Mail.Read offline_access"), true);
});

test("safe authentication errors hide provider details", () => {
  assert.equal(getSafeAuthErrorMessage("AccessDenied"), "Innloggingen ble avbrutt.");
  assert.equal(
    getSafeAuthErrorMessage("OAuthAccountNotLinked"),
    "Denne e-postadressen er allerede knyttet til en annen innloggingsmetode. Logg inn på vanlig måte først.",
  );
  assert.equal(getSafeAuthErrorMessage("OAuthCallback"), "Vi klarte ikke å logge deg inn med Microsoft. Prøv igjen.");
});
