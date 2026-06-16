-- CreateTable
CREATE TABLE "CancellationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "method" TEXT NOT NULL DEFAULT 'email',
    "recipientEmail" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerNumber" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "consentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "providerResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CancellationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "cancellationRequestId" TEXT,
    "action" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CancellationAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CancellationRequest_userId_idx" ON "CancellationRequest"("userId");

-- CreateIndex
CREATE INDEX "CancellationRequest_subscriptionId_idx" ON "CancellationRequest"("subscriptionId");

-- CreateIndex
CREATE INDEX "CancellationRequest_status_idx" ON "CancellationRequest"("status");

-- CreateIndex
CREATE INDEX "CancellationRequest_createdAt_idx" ON "CancellationRequest"("createdAt");

-- CreateIndex
CREATE INDEX "CancellationAuditLog_userId_idx" ON "CancellationAuditLog"("userId");

-- CreateIndex
CREATE INDEX "CancellationAuditLog_subscriptionId_idx" ON "CancellationAuditLog"("subscriptionId");

-- CreateIndex
CREATE INDEX "CancellationAuditLog_cancellationRequestId_idx" ON "CancellationAuditLog"("cancellationRequestId");

-- CreateIndex
CREATE INDEX "CancellationAuditLog_action_idx" ON "CancellationAuditLog"("action");

-- CreateIndex
CREATE INDEX "CancellationAuditLog_createdAt_idx" ON "CancellationAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "CancellationRequest" ADD CONSTRAINT "CancellationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationRequest" ADD CONSTRAINT "CancellationRequest_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationAuditLog" ADD CONSTRAINT "CancellationAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
