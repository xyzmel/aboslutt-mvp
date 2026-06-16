-- Defensive forward migration for production databases where the earlier
-- notification migration was not applied before notification code deployed.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailRemindersEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reminderDaysBefore" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "monthlySummaryEnabled" BOOLEAN NOT NULL DEFAULT false;
