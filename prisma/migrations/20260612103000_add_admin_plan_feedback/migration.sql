-- Add safe beta admin metadata and feedback storage.
ALTER TABLE "User" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'free';

CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "message" TEXT NOT NULL,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
