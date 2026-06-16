ALTER TABLE "Subscription" ADD COLUMN "billingInterval" TEXT NOT NULL DEFAULT 'monthly';

CREATE INDEX "Subscription_billingInterval_idx" ON "Subscription"("billingInterval");
