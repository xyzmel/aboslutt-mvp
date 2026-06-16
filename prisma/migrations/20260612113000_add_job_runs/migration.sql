CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "triggeredByEmail" TEXT,
    "usersChecked" INTEGER NOT NULL DEFAULT 0,
    "emailsSent" INTEGER NOT NULL DEFAULT 0,
    "remindersCreated" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobRun_type_idx" ON "JobRun"("type");
CREATE INDEX "JobRun_createdAt_idx" ON "JobRun"("createdAt");
