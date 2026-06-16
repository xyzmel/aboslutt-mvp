-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "confidence" DOUBLE PRECISION;
ALTER TABLE "Subscription" ADD COLUMN "normalizedName" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "source" TEXT;

-- CreateIndex
CREATE INDEX "Subscription_normalizedName_idx" ON "Subscription"("normalizedName");
