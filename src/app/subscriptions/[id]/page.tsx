import { notFound, redirect } from "next/navigation";
import { SubscriptionDetailClient } from "@/components/subscriptions/SubscriptionDetailClient";
import { getCurrentAppUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { normalizeNextPaymentDate } from "@/lib/subscription-dates";

type SubscriptionDetailPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function SubscriptionDetailPage({ params }: SubscriptionDetailPageProps) {
  const currentUser = await getCurrentAppUser();

  if (!currentUser) {
    redirect("/login");
  }

  const { id } = await params;
  const subscription = await prisma.subscription.findFirst({
    where: { id, userId: currentUser.id },
    select: {
      id: true,
      name: true,
      normalizedName: true,
      category: true,
      monthlyCost: true,
      status: true,
      billingInterval: true,
      nextPayment: true,
      note: true,
      source: true,
      confidence: true,
      createdAt: true,
    },
  });

  if (!subscription) {
    notFound();
  }

  let nextPayment = subscription.nextPayment;
  const normalizedNextPayment = normalizeNextPaymentDate({
    nextPayment: subscription.nextPayment,
    billingInterval: subscription.billingInterval as "monthly" | "yearly" | "unknown",
    status: subscription.status,
  });

  if (
    subscription.status !== "cancelled" &&
    ["monthly", "yearly"].includes(subscription.billingInterval) &&
    normalizedNextPayment &&
    normalizedNextPayment !== subscription.nextPayment
  ) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { nextPayment: normalizedNextPayment },
    });
    nextPayment = normalizedNextPayment;
  }

  return (
    <SubscriptionDetailClient
      initialSubscription={{
        ...subscription,
        nextPayment,
        category: subscription.category as "streaming" | "software" | "news" | "health",
        status: subscription.status as "active" | "trial" | "yearly" | "cancelled",
        billingInterval: subscription.billingInterval as "monthly" | "yearly" | "unknown",
        createdAt: subscription.createdAt.toISOString(),
      }}
    />
  );
}
