-- CreateTable
CREATE TABLE "IgnoredImportCandidate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceProvider" TEXT NOT NULL,
    "normalizedName" TEXT,
    "merchantName" TEXT,
    "amount" INTEGER,
    "sourceFingerprint" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IgnoredImportCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceProvider" TEXT NOT NULL,
    "merchantName" TEXT,
    "normalizedName" TEXT,
    "amount" INTEGER,
    "confidenceScore" INTEGER,
    "issueType" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IgnoredImportCandidate_userId_sourceFingerprint_key" ON "IgnoredImportCandidate"("userId", "sourceFingerprint");
CREATE INDEX "IgnoredImportCandidate_userId_idx" ON "IgnoredImportCandidate"("userId");
CREATE INDEX "IgnoredImportCandidate_sourceProvider_idx" ON "IgnoredImportCandidate"("sourceProvider");
CREATE INDEX "IgnoredImportCandidate_normalizedName_idx" ON "IgnoredImportCandidate"("normalizedName");
CREATE INDEX "IgnoredImportCandidate_createdAt_idx" ON "IgnoredImportCandidate"("createdAt");
CREATE INDEX "ImportFeedback_userId_idx" ON "ImportFeedback"("userId");
CREATE INDEX "ImportFeedback_sourceProvider_idx" ON "ImportFeedback"("sourceProvider");
CREATE INDEX "ImportFeedback_issueType_idx" ON "ImportFeedback"("issueType");
CREATE INDEX "ImportFeedback_createdAt_idx" ON "ImportFeedback"("createdAt");

-- AddForeignKey
ALTER TABLE "IgnoredImportCandidate" ADD CONSTRAINT "IgnoredImportCandidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportFeedback" ADD CONSTRAINT "ImportFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
