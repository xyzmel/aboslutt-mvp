import { test, expect } from "./support/fixtures";
import { createBillingAgreement } from "./support/database";
import { login } from "./support/auth";

const disconnectedConnections = {
  googleMailConnectEnabled: false,
  googleConnected: false,
  gmailScopeConnected: false,
  gmailScanAvailable: false,
  microsoftConnected: false,
  microsoftExpired: false,
  microsoftStatus: "disconnected",
  microsoftMailScopeConnected: false,
  microsoftConfigured: true,
  microsoftEmail: null,
  plan: "free",
};

test.describe("free, premium, and provider connections", () => {
  test("free user sees the free plan and Premium gating", async ({ page, freeUser }) => {
    await login(page, freeUser);
    await page.route("**/api/connections", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(disconnectedConnections) }),
    );
    await page.goto("/import/email");

    await expect(page.getByText("Gmail-import blir tilgjengelig når godkjenningen er fullført.").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "E-postskanning krever Premium" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Skann e-post" })).toHaveCount(0);
  });

  test("premium user can access connected Outlook scanning", async ({ page, premiumUser }) => {
    await login(page, premiumUser);
    await page.route("**/api/connections", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...disconnectedConnections,
          gmailScanAvailable: true,
          microsoftConnected: true,
          microsoftStatus: "connected",
          microsoftMailScopeConnected: true,
          microsoftEmail: "premium@outlook.test",
          plan: "premium",
        }),
      }),
    );
    await page.goto("/import/email");

    const outlookCard = page.locator("article").filter({ has: page.getByRole("heading", { name: "Outlook" }) });
    await expect(outlookCard.getByText("Tilkoblet")).toBeVisible();
    await expect(outlookCard.getByText("premium@outlook.test")).toBeVisible();
    await expect(outlookCard.getByRole("button", { name: "Skann e-post" })).toBeVisible();
  });

  test("expired historical Premium never replaces the current free plan", async ({ page, freeUser }) => {
    await createBillingAgreement(freeUser.id, "expired");
    await login(page, freeUser);
    await page.goto("/settings");

    await expect(page.getByText("Gratisplan aktiv")).toBeVisible();
    await expect(page.getByText(/Premium utløp/)).toBeVisible();
    await expect(page.getByText("Premium aktiv")).toHaveCount(0);
  });

  test("provider cards load together and never show connected plus expired", async ({ page, freeUser }) => {
    await login(page, freeUser);
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });

    await page.route("**/api/connections", async (route) => {
      await responseGate;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...disconnectedConnections, microsoftExpired: true, microsoftStatus: "expired" }),
      });
    });

    const navigation = page.goto("/import/email");
    await expect(page.getByLabel("Henter status for Gmail")).toBeVisible();
    await expect(page.getByLabel("Henter status for Outlook")).toBeVisible();
    releaseResponse();
    await navigation;

    const outlookCard = page.locator("article").filter({ has: page.getByRole("heading", { name: "Outlook" }) });
    await expect(outlookCard.getByText("Må kobles til på nytt")).toBeVisible();
    await expect(outlookCard.getByText("Tilkoblet")).toHaveCount(0);
    const reconnect = outlookCard.getByRole("link", { name: "Koble til på nytt" });
    await expect(reconnect).toBeVisible();
    await expect(reconnect).toHaveAttribute("href", "/api/import/microsoft/connect");
  });

  test("connected Outlook disconnects without conflicting state", async ({ page, premiumUser }) => {
    await login(page, premiumUser);
    await page.route("**/api/connections", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...disconnectedConnections,
          gmailScanAvailable: true,
          microsoftConnected: true,
          microsoftStatus: "connected",
          microsoftMailScopeConnected: true,
          microsoftEmail: "mailbox@outlook.test",
          plan: "premium",
        }),
      }),
    );
    await page.route("**/api/import/microsoft/disconnect", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }),
    );
    await page.goto("/import/email");

    const outlookCard = page.locator("article").filter({ has: page.getByRole("heading", { name: "Outlook" }) });
    await outlookCard.getByRole("button", { name: "Koble fra" }).click();
    await expect(outlookCard.getByText("Microsoft er koblet fra. Outlook-tilgangen er fjernet.")).toBeVisible();
    await expect(outlookCard.getByText("Tilkoblet")).toHaveCount(0);
  });
});
