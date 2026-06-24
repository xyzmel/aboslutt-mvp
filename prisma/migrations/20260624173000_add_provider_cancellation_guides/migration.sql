ALTER TABLE "SubscriptionProvider"
ADD COLUMN "cancellationMethod" TEXT,
ADD COLUMN "cancellationInstructions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "requiredInformation" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "confirmationExpected" TEXT,
ADD COLUMN "countryCode" TEXT,
ADD COLUMN "verificationSource" TEXT,
ADD COLUMN "isCancellationGuideActive" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "SubscriptionProvider_isCancellationGuideActive_idx"
ON "SubscriptionProvider"("isCancellationGuideActive");
