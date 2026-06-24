import { test as base } from "@playwright/test";
import { createTestUser, deleteTestUser, type TestUser } from "./database";
import { login } from "./auth";

type Fixtures = {
  freeUser: TestUser;
  premiumUser: TestUser;
  authenticatedPage: void;
};

export const test = base.extend<Fixtures>({
  freeUser: async ({}, provide) => {
    const user = await createTestUser("free");
    await provide(user);
    await deleteTestUser(user.email);
  },
  premiumUser: async ({}, provide) => {
    const user = await createTestUser("premium");
    await provide(user);
    await deleteTestUser(user.email);
  },
  authenticatedPage: async ({ page, freeUser }, provide) => {
    await login(page, freeUser);
    await provide();
  },
});

export { expect } from "@playwright/test";
