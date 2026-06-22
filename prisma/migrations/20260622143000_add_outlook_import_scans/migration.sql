CREATE TABLE "OutlookImportScan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "candidates" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "importedAt" TIMESTAMP(3),

    CONSTRAINT "OutlookImportScan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OutlookImportScan_userId_idx" ON "OutlookImportScan"("userId");
CREATE INDEX "OutlookImportScan_status_idx" ON "OutlookImportScan"("status");
CREATE INDEX "OutlookImportScan_expiresAt_idx" ON "OutlookImportScan"("expiresAt");
CREATE INDEX "OutlookImportScan_createdAt_idx" ON "OutlookImportScan"("createdAt");

ALTER TABLE "OutlookImportScan"
ADD CONSTRAINT "OutlookImportScan_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
