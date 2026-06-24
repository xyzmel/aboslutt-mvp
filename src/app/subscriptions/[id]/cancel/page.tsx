import { redirect } from "next/navigation";
import { CancellationEmailClient } from "@/components/cancellation/CancellationEmailClient";
import { AppFooter } from "@/components/navigation/AppFooter";
import { AppHeader } from "@/components/navigation/AppHeader";
import { canSendCancellationEmail } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { getCurrentAppUser } from "@/lib/current-user";
import { toPublicCancellationGuide } from "@/lib/provider-cancellation-guide.mjs";
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
      provider: {
        select: {
          id: true,
          name: true,
          logoPath: true,
          accountManagementUrl: true,
          cancellationUrl: true,
          cancellationMethod: true,
          cancellationInstructions: true,
          requiredInformation: true,
          confirmationExpected: true,
          isCancellationGuideActive: true,
          supportsAbosluttSending: true,
          sendingVerifiedAt: true,
          requiresProviderLogin: true,
          requiresCustomerReference: true,
          isActive: true,
          lastVerifiedAt: true,
        },
      },
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
      requestedEndDate: true,
      createdAt: true,
      updatedAt: true,
      events: {
        orderBy: { createdAt: "asc" },
        select: { id: true, type: true, message: true, createdAt: true },
      },
      delivery: {
        select: {
          recipient: true,
          deliveryStatus: true,
          bounceStatus: true,
          sentAt: true,
        },
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
        guide={subscription.provider ? toPublicCancellationGuide(subscription.provider) : null}
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
  provider?: unknown;
}): Subscription {
  return {
    id: subscription.id,
    name: subscription.name,
    normalizedName: subscription.normalizedName,
    category: subscription.category as SubscriptionCategory,
    monthlyCost: subscription.monthlyCost,
    status: subscription.status as SubscriptionStatus,
    billingInterval: subscription.billingInterval as BillingInterval,
    nextPayment: subscription.nextPayment,
    note: subscription.note,
    source: subscription.source,
    confidence: subscription.confidence,
    createdAt: subscription.createdAt.toISOString(),
  };
}
