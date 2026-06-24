CREATE TABLE "SubscriptionProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "senderNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emailDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "logoPath" TEXT,
    "websiteUrl" TEXT,
    "accountManagementUrl" TEXT,
    "cancellationUrl" TEXT,
    "defaultBillingInterval" TEXT,
    "supportedCountries" TEXT[] DEFAULT ARRAY['NO']::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionProvider_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Subscription" ADD COLUMN "providerId" TEXT;

CREATE UNIQUE INDEX "SubscriptionProvider_slug_key" ON "SubscriptionProvider"("slug");
CREATE INDEX "SubscriptionProvider_name_idx" ON "SubscriptionProvider"("name");
CREATE INDEX "SubscriptionProvider_category_idx" ON "SubscriptionProvider"("category");
CREATE INDEX "SubscriptionProvider_isActive_idx" ON "SubscriptionProvider"("isActive");
CREATE INDEX "Subscription_providerId_idx" ON "Subscription"("providerId");

ALTER TABLE "Subscription"
ADD CONSTRAINT "Subscription_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "SubscriptionProvider"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
