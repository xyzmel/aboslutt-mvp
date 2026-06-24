CREATE TABLE "SubscriptionProviderLogo" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),

    CONSTRAINT "SubscriptionProviderLogo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubscriptionProviderLogo_providerId_idx"
ON "SubscriptionProviderLogo"("providerId");

CREATE INDEX "SubscriptionProviderLogo_status_idx"
ON "SubscriptionProviderLogo"("status");

CREATE INDEX "SubscriptionProviderLogo_fetchedAt_idx"
ON "SubscriptionProviderLogo"("fetchedAt");

ALTER TABLE "SubscriptionProviderLogo"
ADD CONSTRAINT "SubscriptionProviderLogo_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "SubscriptionProvider"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
