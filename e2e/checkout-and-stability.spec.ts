import { test, expect } from "./support/fixtures";
import { createBillingAgreement, createSubscription } from "./support/database";
import { login } from "./support/auth";

test.describe("checkout states and UI stability", () => {
  test("checkout starts once, prevents double submission, and reaches pending state", async ({ page, freeUser }) => {
    await login(page, freeUser);
    let checkoutCalls = 0;
    await page.route("**/api/billing/checkout", async (route) => {
      checkoutCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 150));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, redirectUrl: "/payment/thanks" }),
      });
    });
    await page.route("**/api/billing/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, status: "pending", plan: "free", verification: "checked" }),
      }),
    );
    await page.goto("/pricing");

    const checkout = page.getByRole("button", { name: "Start Premium månedlig med Vipps" });
    await checkout.dblclick();
    await expect(page).toHaveURL(/\/payment\/thanks/);
    await expect(page.getByRole("heading", { name: "Bekrefter betalingen ..." })).toBeVisible();
    expect(checkoutCalls).toBe(1);
  });

  for (const state of [
    ["cancelled", "Betalingen ble avbrutt"],
    ["failed", "Betalingen kunne ikke bekreftes"],
    ["expired", "Betalingen utløp"],
  ] as const) {
    test(`${state[0]} checkout shows a truthful retry state`, async ({ page, freeUser }) => {
      await login(page, freeUser);
      await page.route("**/api/billing/status", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, status: state[0], plan: "free", verification: "checked" }),
        }),
      );
      await page.goto(state[0] === "cancelled" ? "/payment/cancelled" : "/payment/thanks");
      await expect(page.getByRole("heading", { name: state[1] }).last()).toBeVisible();
      await expect(page.getByRole("link", { name: "Prøv igjen" })).toBeVisible();
      await expect(page.getByText("Premium er aktivert")).toHaveCount(0);
    });
  }

  test("Premium is shown only after confirmed backend status", async ({ page, freeUser }) => {
    await createBillingAgreement(freeUser.id, "pending", { providerAgreementId: null });
    await login(page, freeUser);
    await page.goto("/payment/thanks");
    await expect(page.getByRole("heading", { name: "Bekrefter betalingen ..." })).toBeVisible();
    await expect(page.getByText("Premium er aktivert")).toHaveCount(0);
  });

  test("confirmed active status refreshes the Premium experience", async ({ page, premiumUser }) => {
    await createBillingAgreement(premiumUser.id, "active");
    await login(page, premiumUser);
    await page.goto("/payment/thanks");
    await expect(page.getByRole("heading", { name: "Premium er aktivert" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Gå til oversikt" })).toBeVisible();
  });

  test("dashboard does not flash a false empty state while subscriptions load", async ({ page, freeUser }) => {
    await createSubscription(freeUser.id, { name: "Forsinket abonnement" });
    await login(page, freeUser);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/subscriptions", async (route) => {
      await gate;
      await route.continue();
    });

    const navigation = page.goto("/dashboard");
    await expect(page.getByLabel("Henter abonnementer")).toBeVisible();
    await expect(page.getByText("Ingen aktive abonnementer")).toHaveCount(0);
    release();
    await navigation;
    await expect(page.getByText("Forsinket abonnement")).toBeVisible();
  });

  test("repeated checkout failure produces one toast", async ({ page, freeUser }) => {
    await login(page, freeUser);
    await page.route("**/api/billing/checkout", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "PAYMENTS_NOT_CONFIGURED" }),
      }),
    );
    await page.goto("/pricing");

    const checkout = page.getByRole("button", { name: "Start Premium månedlig med Vipps" });
    await checkout.click();
    await expect(page.getByText("Betaling kunne ikke startes")).toHaveCount(1);
    await checkout.click();
    await expect(page.getByText("Betaling kunne ikke startes")).toHaveCount(1);
  });

  test("subscription card actions align within the same grid row", async ({ page, freeUser }) => {
    await createSubscription(freeUser.id, { name: "Kort A", monthlyCost: 99 });
    await createSubscription(freeUser.id, { name: "Kort B", monthlyCost: 199 });
    await login(page, freeUser);

    const firstCard = page.locator("article").filter({ hasText: "Kort A" });
    const secondCard = page.locator("article").filter({ hasText: "Kort B" });
    const firstAction = await firstCard.getByRole("button", { name: "Rediger" }).boundingBox();
    const secondAction = await secondCard.getByRole("button", { name: "Rediger" }).boundingBox();

    expect(firstAction).not.toBeNull();
    expect(secondAction).not.toBeNull();
    expect(Math.abs((firstAction?.y ?? 0) - (secondAction?.y ?? 0))).toBeLessThanOrEqual(2);
  });

  test("authenticated pages have no horizontal overflow at 375px", async ({ page, freeUser }) => {
    await login(page, freeUser);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");

    const sizes = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(sizes.content).toBeLessThanOrEqual(sizes.viewport + 1);
  });
});
