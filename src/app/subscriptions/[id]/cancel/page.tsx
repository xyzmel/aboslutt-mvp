import { redirect } from "next/navigation";
import { CancellationEmailClient } from "@/components/cancellation/CancellationEmailClient";
import { AppFooter } from "@/components/navigation/AppFooter";
import { AppHeader } from "@/components/navigation/AppHeader";
import { findCancellationProvider } from "@/data/cancellation-providers";
import { canSendCancellationEmail } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { getCurrentAppUser } from "@/lib/current-user";
import type { BillingInterval, Subscription, SubscriptionCategory, SubscriptionStatus } from "@/types/subscription";

type CancelPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function CancelSubscriptionPage({ params }: CancelPageProps) {
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
      category: true,
      monthlyCost: true,
      status: true,
      billingInterval: true,
      normalizedName: true,
      nextPayment: true,
      note: true,
      source: true,
      confidence: true,
      createdAt: true,
    },
  });

  if (!subscription) {
    redirect("/dashboard");
  }

  const latestRequest = await prisma.cancellationRequest.findFirst({
    where: { userId: currentUser.id, subscriptionId: subscription.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      status: true,
      method: true,
      recipientEmail: true,
      customerName: true,
      customerEmail: true,
      customerNumber: true,
      subject: true,
      body: true,
      consentConfirmed: true,
      sentAt: true,
      confirmedAt: true,
      rejectedAt: true,
      providerResponse: true,
      createdAt: true,
      updatedAt: true,
      events: {
        orderBy: { createdAt: "asc" },
        select: { id: true, type: true, message: true, createdAt: true },
      },
    },
  });

  return (
    <main className="flex min-h-screen flex-col bg-[#F0F4F8] text-[#0D1B2A]">
      <AppHeader maxWidthClassName="max-w-4xl" />
      <CancellationEmailClient
        canSend={canSendCancellationEmail(currentUser)}
        currentUserEmail={currentUser.email}
        currentUserName={currentUser.name}
        initialRequest={latestRequest}
        provider={findCancellationProvider(subscription.name, subscription.normalizedName)}
        subscription={toSubscriptionView(subscription)}
      />
      <AppFooter compact />
    </main>
  );
}

function toSubscriptionView(subscription: {
  id: string;
  name: string;
  category: string;
  monthlyCost: number;
  status: string;
  billingInterval: string;
  normalizedName: string | null;
  nextPayment: string;
  note: string | null;
  source: string | null;
  confidence: number | null;
  createdAt: Date;
}): Subscription {
  return {
    ...subscription,
    category: subscription.category as SubscriptionCategory,
    status: subscription.status as SubscriptionStatus,
    billingInterval: subscription.billingInterval as BillingInterval,
    createdAt: subscription.createdAt.toISOString(),
  };
}
