import { test, expect } from "./support/fixtures";
import { getSubscription } from "./support/database";

test.describe("subscription lifecycle", () => {
  test("creates, edits, cancels, moves to history, and deletes only after confirmation", async ({
    page,
    authenticatedPage,
  }) => {
    void authenticatedPage;
    const name = `Playwright TV ${Date.now()}`;
    const editedName = `${name} Redigert`;
    const manualForm = page.locator("#manual-add");

    await manualForm.getByLabel("Leverandør").fill(name);
    await manualForm.getByRole("option", { name: `Legg til «${name}»` }).click();
    await manualForm.getByLabel("Kr/mnd").fill("149");
    await manualForm.getByLabel("Kategori").selectOption("streaming");
    await manualForm.getByLabel("Intervall").selectOption("monthly");
    await manualForm.getByRole("button", { name: "Legg til abonnement" }).click();

    const card = page.locator("article").filter({ hasText: name });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Rediger" }).click();
    const editDialog = page.getByRole("dialog", { name: "Rediger abonnement" });
    await editDialog.getByLabel("Leverandør").fill(editedName);
    await editDialog.getByRole("option", { name: `Legg til «${editedName}»` }).click();
    await editDialog.getByLabel("Kr/mnd").fill("169");
    await editDialog.getByRole("button", { name: "Lagre endringer" }).click();

    const editedCard = page.locator("article").filter({ hasText: editedName });
    await expect(editedCard).toContainText("169 kr");
    const detailsHref = await editedCard.getByRole("link", { name: "Detaljer" }).getAttribute("href");
    const subscriptionId = detailsHref?.split("/").pop();
    expect(subscriptionId).toBeTruthy();

    const activeDelete = await page.request.delete(`/api/subscriptions/${subscriptionId}`, {
      data: { confirmation: "SLETT" },
    });
    expect(activeDelete.status()).toBe(409);

    await editedCard.getByRole("link", { name: "Si opp" }).click();
    await page.getByLabel("Oppsigelsesmetode").selectOption("manual_unknown");
    await page.getByRole("button", { name: "Lagre utkast" }).click();
    await expect(page.getByText("Oppsigelsesutkastet er klart.")).toBeVisible();

    const inProgress = await getSubscription(subscriptionId!);
    expect(inProgress?.cancellationRequests[0]?.status).toBe("ready");
    const inProgressDelete = await page.request.delete(`/api/subscriptions/${subscriptionId}`, {
      data: { confirmation: "SLETT" },
    });
    expect(inProgressDelete.status()).toBe(409);

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Bekreftet avsluttet" }).click();
    await expect(page.getByText("Bekreftet som avsluttet. Abonnementet er markert som avsluttet.")).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.locator("#subscriptions").getByText(editedName)).toHaveCount(0);
    const history = page.getByTestId("cancellation-history");
    await expect(history).toContainText(new RegExp(escapeRegExp(editedName), "i"));

    await page.goto(`/subscriptions/${subscriptionId}`);
    await expect(page.getByRole("button", { name: "Slett" })).toBeVisible();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Slett" }).click();
    expect(await getSubscription(subscriptionId!)).not.toBeNull();

    page.once("dialog", (dialog) => dialog.accept("SLETT"));
    await page.getByRole("button", { name: "Slett" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    expect(await getSubscription(subscriptionId!)).toBeNull();
  });
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
