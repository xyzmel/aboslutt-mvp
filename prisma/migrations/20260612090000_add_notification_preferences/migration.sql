ALTER TABLE "User"
  ADD COLUMN "emailRemindersEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "reminderDaysBefore" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "monthlySummaryEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ReminderLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "reminderDate" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReminderLog_userId_idx" ON "ReminderLog"("userId");
CREATE INDEX "ReminderLog_subscriptionId_idx" ON "ReminderLog"("subscriptionId");
CREATE INDEX "ReminderLog_reminderDate_idx" ON "ReminderLog"("reminderDate");
CREATE UNIQUE INDEX "ReminderLog_userId_subscriptionId_reminderDate_type_key"
  ON "ReminderLog"("userId", "subscriptionId", "reminderDate", "type");

ALTER TABLE "ReminderLog"
  ADD CONSTRAINT "ReminderLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReminderLog"
  ADD CONSTRAINT "ReminderLog_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
