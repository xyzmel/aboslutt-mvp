-- CreateTable
CREATE TABLE "BetaRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "BetaRequest_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN "page" TEXT;
ALTER TABLE "Feedback" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "Feedback" ADD COLUMN "reviewedBy" TEXT;

-- CreateIndex
CREATE INDEX "BetaRequest_email_idx" ON "BetaRequest"("email");
CREATE INDEX "BetaRequest_status_idx" ON "BetaRequest"("status");
CREATE INDEX "BetaRequest_createdAt_idx" ON "BetaRequest"("createdAt");
CREATE INDEX "BetaRequest_reviewedBy_idx" ON "BetaRequest"("reviewedBy");
CREATE INDEX "Feedback_reviewedAt_idx" ON "Feedback"("reviewedAt");

-- AddForeignKey
ALTER TABLE "BetaRequest" ADD CONSTRAINT "BetaRequest_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
