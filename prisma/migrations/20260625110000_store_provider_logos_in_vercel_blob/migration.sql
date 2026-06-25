ALTER TABLE "SubscriptionProviderLogo"
ADD COLUMN "sourceWebsite" TEXT,
ADD COLUMN "blobUrl" TEXT,
ALTER COLUMN "data" DROP NOT NULL;

CREATE INDEX "SubscriptionProviderLogo_blobUrl_idx"
ON "SubscriptionProviderLogo"("blobUrl");
