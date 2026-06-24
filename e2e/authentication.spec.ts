import { test, expect } from "./support/fixtures";
import {
  createTestUser,
  deleteTestUser,
  findUser,
  verifyRegisteredUser,
} from "./support/database";
import { login, logout } from "./support/auth";

test.describe("authentication", () => {
  test("registers, verifies, logs in, and logs out an isolated user", async ({ page }) => {
    const email = `playwright+register-${Date.now()}@aboslutt.test`;

    try {
      await page.goto("/register");
      await page.getByLabel("Navn").fill("Playwright Register");
      await page.getByLabel("E-post").fill(email);
      await page.getByLabel("Passord", { exact: true }).fill("Playwright-passord-2026");
      await page.getByLabel("Bekreft passord").fill("Playwright-passord-2026");
      await page.getByRole("button", { name: "Opprett konto" }).click();

      await expect(page.getByText(/Kontoen er opprettet/)).toBeVisible();
      expect(await findUser(email)).not.toBeNull();
      await verifyRegisteredUser(email);

      await page.goto("/login");
      await page.getByLabel("E-post").fill(email);
      await page.getByLabel("Passord").fill("Playwright-passord-2026");
      await page.getByRole("button", { name: "Fortsett med e-post" }).click();
      await expect(page).toHaveURL(/\/dashboard/);
      await logout(page);
    } finally {
      await deleteTestUser(email);
    }
  });

  test("rejects invalid credentials without exposing technical details", async ({ page, freeUser }) => {
    await page.goto("/login");
    await page.getByLabel("E-post").fill(freeUser.email);
    await page.getByLabel("Passord").fill("feil-passord");
    await page.getByRole("button", { name: "Fortsett med e-post" }).click();

    await expect(page.getByText("E-post eller passord er ikke riktig.")).toBeVisible();
    await expect(page.getByText(/Prisma|CredentialsSignin|stack|adapter/i)).toHaveCount(0);
  });

  test("password reset request always returns the safe response", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("E-post").fill("finnes-ikke@aboslutt.test");
    await page.getByRole("button", { name: "Send lenke" }).click();
    await expect(page.getByText("Hvis e-posten finnes, sender vi deg en lenke.")).toBeVisible();
  });

  test("protected routes redirect to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("a seeded user can log in normally", async ({ page }) => {
    const user = await createTestUser();
    try {
      await login(page, user);
    } finally {
      await deleteTestUser(user.email);
    }
  });
});
