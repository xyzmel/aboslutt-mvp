import { test, expect } from "./support/fixtures";
import { getSubscription } from "./support/database";

test.describe("subscription provider catalog", () => {
  test("selects a catalog provider without overwriting price or date", async ({ page, authenticatedPage }) => {
    void authenticatedPage;
    const form = page.locator("#manual-add");
    await form.getByLabel("Kr/mnd").fill("321");
    await form.getByLabel("Neste trekk").fill("2030-08-12");
    await form.getByLabel("Intervall").selectOption("yearly");
    await form.getByLabel("Leverandør").fill("Spotify");
    await form.getByRole("option", { name: /Spotify/ }).click();

    await expect(form.getByLabel("Kategori")).toHaveValue("streaming");
    await expect(form.getByLabel("Intervall")).toHaveValue("monthly");
    await expect(form.getByLabel("Kr/mnd")).toHaveValue("321");
    await expect(form.getByLabel("Neste trekk")).toHaveValue("2030-08-12");
    await form.getByRole("button", { name: "Legg til", exact: true }).click();

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
    await form.getByLabel("Kr/mnd").fill("250");
    await form.getByRole("button", { name: "Legg til", exact: true }).click();

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
  });
});
