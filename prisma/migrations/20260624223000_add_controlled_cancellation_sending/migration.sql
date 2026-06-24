ALTER TABLE "SubscriptionProvider"
ADD COLUMN "supportsAbosluttSending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "verifiedCancellationEmail" TEXT,
ADD COLUMN "sendingVerifiedAt" TIMESTAMP(3),
ADD COLUMN "requiresProviderLogin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "requiresCustomerReference" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CancellationRequest"
ADD COLUMN "requestedEndDate" TEXT;

CREATE TABLE "CancellationDelivery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "cancellationRequestId" TEXT NOT NULL,
    "authorizationTextVersion" TEXT NOT NULL,
    "authorizationTimestamp" TIMESTAMP(3) NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "messageHash" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'sending',
    "bounceStatus" TEXT NOT NULL DEFAULT 'unknown',
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CancellationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CancellationDelivery_cancellationRequestId_key"
ON "CancellationDelivery"("cancellationRequestId");

CREATE INDEX "CancellationDelivery_userId_idx"
ON "CancellationDelivery"("userId");

CREATE INDEX "CancellationDelivery_providerId_idx"
ON "CancellationDelivery"("providerId");

CREATE INDEX "CancellationDelivery_deliveryStatus_idx"
ON "CancellationDelivery"("deliveryStatus");

CREATE INDEX "CancellationDelivery_sentAt_idx"
ON "CancellationDelivery"("sentAt");

ALTER TABLE "CancellationDelivery"
ADD CONSTRAINT "CancellationDelivery_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CancellationDelivery"
ADD CONSTRAINT "CancellationDelivery_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "SubscriptionProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CancellationDelivery"
ADD CONSTRAINT "CancellationDelivery_cancellationRequestId_fkey"
FOREIGN KEY ("cancellationRequestId") REFERENCES "CancellationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
