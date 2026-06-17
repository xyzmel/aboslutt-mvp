CREATE TABLE "BillingAgreement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'vipps',
    "providerAgreementId" TEXT,
    "providerChargeId" TEXT,
    "reference" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priceNok" INTEGER NOT NULL,
    "interval" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NOK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "BillingAgreement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'vipps',
    "eventType" TEXT NOT NULL,
    "providerEventId" TEXT,
    "providerAgreementId" TEXT,
    "providerChargeId" TEXT,
    "reference" TEXT,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingAgreement_providerAgreementId_key" ON "BillingAgreement"("providerAgreementId");
CREATE UNIQUE INDEX "BillingAgreement_reference_key" ON "BillingAgreement"("reference");
CREATE INDEX "BillingAgreement_userId_idx" ON "BillingAgreement"("userId");
CREATE INDEX "BillingAgreement_status_idx" ON "BillingAgreement"("status");
CREATE INDEX "BillingEvent_eventType_idx" ON "BillingEvent"("eventType");
CREATE INDEX "BillingEvent_reference_idx" ON "BillingEvent"("reference");
CREATE INDEX "BillingEvent_providerAgreementId_idx" ON "BillingEvent"("providerAgreementId");
CREATE INDEX "BillingEvent_providerChargeId_idx" ON "BillingEvent"("providerChargeId");
CREATE INDEX "BillingEvent_providerEventId_idx" ON "BillingEvent"("providerEventId");

ALTER TABLE "BillingAgreement" ADD CONSTRAINT "BillingAgreement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
