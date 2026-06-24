import { test, expect } from "./support/fixtures";
import {
  createSubscription,
  createSubscriptionProvider,
  deleteSubscriptionProvider,
  getSubscription,
} from "./support/database";
import { login } from "./support/auth";

test.describe("subscription provider catalog", () => {
  test("selects a catalog provider without overwriting price or date", async ({ page, authenticatedPage }) => {
    void authenticatedPage;
    const form = page.locator("#manual-add");
    await form.getByLabel("Kr/mnd").fill("321");
    await form.getByLabel("Neste trekk").fill("2030-08-12");
    await form.getByLabel("Intervall").selectOption("yearly");
    await form.getByLabel("Leverandør").fill("Spotify");
    await form.getByRole("option", { name: "Spotify", exact: true }).click();

    await expect(form.getByRole("option", { name: "Spotify", exact: true })).toHaveCount(0);
    await expect(form.getByLabel("Leverandør")).toBeFocused();
    await expect(form.getByText("Valgt fra leverandørkatalogen")).toBeVisible();
    await expect(form.getByRole("button", { name: "Legg til abonnement" })).toBeEnabled();
    await expect(form.getByLabel("Kategori")).toHaveValue("streaming");
    await expect(form.getByLabel("Intervall")).toHaveValue("yearly");
    await expect(form.getByLabel("Kr/mnd")).toHaveValue("321");
    await expect(form.getByLabel("Neste trekk")).toHaveValue("2030-08-12");
    await form.getByRole("button", { name: "Legg til abonnement" }).click();

    const card = page.locator("article").filter({ hasText: "Spotify" });
    const href = await card.getByRole("link", { name: "Detaljer" }).getAttribute("href");
    const subscription = await getSubscription(href!.split("/").pop()!);
    expect(subscription?.providerId).not.toBeNull();
  });

  test("creates a custom subscription without creating or linking a global provider", async ({ page, authenticatedPage }) => {
    void authenticatedPage;
    const customName = `Lokal klubb ${Date.now()}`;
    const form = page.locator("#manual-add");
    await form.getByLabel("Leverandør").fill(customName);
    await form.getByRole("option", { name: `Legg til «${customName}»` }).click();
    await expect(form.getByRole("option", { name: `Legg til «${customName}»` })).toHaveCount(0);
    await expect(form.getByLabel("Leverandør")).toBeFocused();
    await form.getByLabel("Kr/mnd").fill("250");
    await form.getByRole("button", { name: "Legg til abonnement" }).click();

    const card = page.locator("article").filter({ hasText: customName });
    const href = await card.getByRole("link", { name: "Detaljer" }).getAttribute("href");
    const subscription = await getSubscription(href!.split("/").pop()!);
    expect(subscription?.providerId).toBeNull();
  });

  test("ordinary users cannot modify the global catalog", async ({ page, authenticatedPage }) => {
    void authenticatedPage;
    const response = await page.request.post("/api/admin/subscription-providers", {
      data: { name: "Ikke tillatt", slug: "ikke-tillatt", category: "other" },
    });
    expect(response.status()).toBe(403);
    const logoResponse = await page.request.post("/api/admin/subscription-providers/not-allowed/logo", {
      data: { action: "fetch" },
    });
    expect(logoResponse.status()).toBe(403);
    const capabilityResponse = await page.request.patch("/api/admin/subscription-providers/not-allowed", {
      data: {
        name: "Ikke tillatt",
        slug: "ikke-tillatt",
        category: "other",
        supportsAbosluttSending: true,
        verifiedCancellationEmail: "cancel@example.no",
        sendingVerifiedAt: "2026-06-24",
      },
    });
    expect(capabilityResponse.status()).toBe(403);
  });

  test("receipt review shows catalog metadata and never imports automatically", async ({ page, authenticatedPage }) => {
    void authenticatedPage;
    let subscriptionCreates = 0;
    await page.route("**/api/import/email", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          candidates: [
            {
              providerId: "spotify",
              canonicalProviderName: "Spotify",
              originalDetectedName: "SPOTIFY AB",
              providerLogoPath: "/providers/catalog-test.svg",
              merchantName: "Spotify",
              amount: 129,
              currency: "NOK",
              billingInterval: "monthly",
              category: "streaming",
              confidence: 0.92,
              confidenceLabel: "high",
              confidenceScore: 92,
              reasons: ["Eksakt kjent avsenderdomene"],
              warnings: [],
              source: "gmail_import",
              nextPayment: "Ukjent",
              sourceProvider: "pasted_email",
              sourceFingerprint: "e2e-candidate",
              likelyDuplicate: false,
              duplicateMessage: null,
            },
          ],
        }),
      }),
    );
    await page.route("**/api/subscriptions", async (route) => {
      if (route.request().method() === "POST") subscriptionCreates += 1;
      await route.continue();
    });

    await page.goto("/import/email");
    await page.getByLabel("E-posttekst").fill("Spotify abonnement månedlig NOK 129 neste trekk");
    await page.getByRole("button", { name: "Finn abonnement" }).click();

    const candidate = page.locator("article").filter({ hasText: "Spotify" });
    await expect(candidate.getByTestId("candidate-provider-logo")).toBeVisible();
    await expect(candidate).toContainText("Opprinnelig funn: SPOTIFY AB");
    await expect(candidate).toContainText("Streaming");
    expect(subscriptionCreates).toBe(0);
  });

  test("provider guide marks request sent before explicit completion", async ({ page, authenticatedPage }) => {
    void authenticatedPage;
    const form = page.locator("#manual-add");
    await form.getByLabel("Leverandør").fill("Netflix");
    await form.getByRole("option", { name: "Netflix", exact: true }).click();
    await form.getByLabel("Kr\/mnd").fill("169");
    await form.getByRole("button", { name: "Legg til abonnement" }).click();

    const card = page.locator("article").filter({ hasText: "Netflix" });
    const href = await card.getByRole("link", { name: "Detaljer" }).getAttribute("href");
    const subscriptionId = href!.split("/").pop()!;
    await card.getByRole("link", { name: "Si opp" }).click();

    await expect(page.getByText("Netflix", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Velg hvordan du vil avslutte" })).toBeVisible();
    await page.getByRole("button", { name: "Fortsett" }).click();
    await page.getByRole("button", { name: "Klargjør oppsigelsen" }).click();
    await page.getByRole("button", { name: "Jeg har sendt oppsigelsen" }).click();
    await expect(page.getByText("Venter på bekreftelse", { exact: true })).toBeVisible();

    const pending = await getSubscription(subscriptionId);
    expect(pending?.status).toBe("active");
    expect(pending?.cancellationRequests[0]?.status).toBe("awaiting_confirmation");

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Bekreft avsluttet" }).click();
    await expect(page.getByText("Abonnementet er registrert som bekreftet avsluttet.")).toBeVisible();
    const completed = await getSubscription(subscriptionId);
    expect(completed?.status).toBe("cancelled");
  });

  test("verified Aboslutt sending requires authorization and keeps delivery failures in review", async ({
    page,
    premiumUser,
  }) => {
    const provider = await createSubscriptionProvider({
      name: "Playwright Verified Send",
      supportsAbosluttSending: true,
      verifiedCancellationEmail: "cancel@provider.example",
      sendingVerifiedAt: new Date(),
    });
    const subscription = await createSubscription(premiumUser.id, {
      providerId: provider.id,
      name: provider.name,
    });

    try {
      await login(page, premiumUser);
      await page.goto(`/subscriptions/${subscription.id}/cancel`);
      await expect(page.getByLabel("Send via Aboslutt")).toBeChecked();
      await page.getByRole("button", { name: "Fortsett" }).click();
      await page.getByRole("button", { name: "Klargjør oppsigelsen" }).click();
      await expect(page.getByRole("button", { name: "Bekreft avsluttet" })).toHaveCount(0);

      let attempts = 0;
      await page.route(`**/api/subscriptions/${subscription.id}/cancellation`, async (route) => {
        if (route.request().method() !== "PATCH") return route.continue();
        attempts += 1;
        if (attempts === 1) {
          return route.fulfill({
            status: 502,
            contentType: "application/json",
            body: JSON.stringify({
              error: "DELIVERY_FAILED",
              message: "Vi klarte ikke å sende oppsigelsen. Bruk den manuelle metoden og kontakt leverandøren direkte.",
            }),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            request: {
              id: "request-e2e",
              status: "awaiting_confirmation",
              method: "aboslutt_email",
              recipientEmail: "cancel@provider.example",
              customerName: premiumUser.email,
              customerEmail: premiumUser.email,
              customerNumber: null,
              subject: "Oppsigelse",
              body: "Oppsigelse",
              consentConfirmed: true,
              sentAt: new Date().toISOString(),
              confirmedAt: null,
              rejectedAt: null,
              providerResponse: "sent_via_aboslutt",
              requestedEndDate: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              events: [],
              delivery: {
                recipient: "cancel@provider.example",
                deliveryStatus: "accepted",
                bounceStatus: "unknown",
                sentAt: new Date().toISOString(),
              },
            },
          }),
        });
      });

      await page.getByText("Jeg gir Aboslutt begrenset fullmakt", { exact: false }).click();
      await page.getByRole("button", { name: "Send via Aboslutt" }).click();
      await expect(page.getByText("Vi klarte ikke å sende oppsigelsen.", { exact: false })).toBeVisible();
      await expect(page.getByRole("button", { name: "Bekreft avsluttet" })).toHaveCount(0);

      await page.getByRole("button", { name: "Send via Aboslutt" }).click();
      await expect(page.getByRole("button", { name: "Bekreft avsluttet" })).toBeVisible();
      await expect(page.getByText("cancel@provider.example")).toBeVisible();
    } finally {
      await deleteSubscriptionProvider(provider.id);
    }
  });
});
