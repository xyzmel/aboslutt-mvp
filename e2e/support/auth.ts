import { expect, type Page } from "@playwright/test";
import type { TestUser } from "./database";

export async function login(page: Page, user: TestUser) {
  await page.goto("/login");
  await page.getByLabel("E-post").fill(user.email);
  await page.getByLabel("Passord").fill(user.password);
  await page.getByRole("button", { name: "Fortsett med e-post" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: /Oversikt|Få kontroll/i })).toBeVisible();
}

export async function logout(page: Page) {
  const accountMenu = page.locator("summary").filter({ hasText: /Playwright|@aboslutt\.test/ });
  await accountMenu.click();
  await page.getByRole("button", { name: "Logg ut" }).click();
  await expect(page).toHaveURL(/\/login/);
}
