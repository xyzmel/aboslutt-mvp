import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();
const testEmailPrefix = "playwright+";
export const testPassword = "Playwright-passord-2026";

export type TestUser = {
  id: string;
  email: string;
  password: string;
  plan: "free" | "premium";
};

export async function createTestUser(plan: "free" | "premium" = "free"): Promise<TestUser> {
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const email = `${testEmailPrefix}${suffix}@aboslutt.test`;
  const passwordHash = await hash(testPassword, 10);
  const user = await prisma.user.create({
    data: {
      name: `Playwright ${suffix.slice(-4)}`,
      email,
      emailVerified: new Date(),
      passwordHash,
      plan,
    },
    select: { id: true },
  });

  return { id: user.id, email, password: testPassword, plan };
}

export async function deleteTestUser(email: string) {
  await prisma.user.deleteMany({ where: { email } });
}

export async function cleanupAllTestUsers() {
  await prisma.user.deleteMany({
    where: { email: { startsWith: testEmailPrefix } },
  });
}

export async function findUser(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function verifyRegisteredUser(email: string) {
  return prisma.user.update({
    where: { email },
    data: { emailVerified: new Date() },
  });
}

export async function createSubscription(userId: string, overrides: Record<string, unknown> = {}) {
  return prisma.subscription.create({
    data: {
      userId,
      name: "Playwright Streaming",
      normalizedName: `playwright-streaming-${crypto.randomUUID().slice(0, 6)}`,
      category: "streaming",
      monthlyCost: 129,
      status: "active",
      billingInterval: "monthly",
      nextPayment: "2030-07-15",
      source: "manual",
      ...overrides,
    },
  });
}

export async function createSubscriptionProvider(overrides: Record<string, unknown> = {}) {
  const suffix = crypto.randomUUID().slice(0, 8);
  return prisma.subscriptionProvider.create({
    data: {
      name: `Playwright Provider ${suffix}`,
      slug: `playwright-provider-${suffix}`,
      category: "other",
      cancellationMethod: "email",
      cancellationInstructions: ["Send en skriftlig oppsigelse."],
      isCancellationGuideActive: true,
      isActive: true,
      ...overrides,
    },
  });
}

export async function deleteSubscriptionProvider(id: string) {
  await prisma.subscriptionProvider.deleteMany({ where: { id } });
}

export async function createBillingAgreement(
  userId: string,
  status: string,
  overrides: Record<string, unknown> = {},
) {
  return prisma.billingAgreement.create({
    data: {
      userId,
      reference: `e2e-${crypto.randomUUID()}`,
      providerAgreementId: `e2e-agreement-${crypto.randomUUID()}`,
      plan: "premium_monthly",
      status,
      priceNok: 79,
      interval: "month",
      activatedAt: status === "active" ? new Date() : null,
      expiresAt: status === "expired" ? new Date(Date.now() - 86_400_000) : null,
      ...overrides,
    },
  });
}

export async function getSubscription(id: string) {
  return prisma.subscription.findUnique({
    where: { id },
    include: { cancellationRequests: { orderBy: { updatedAt: "desc" } } },
  });
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}
