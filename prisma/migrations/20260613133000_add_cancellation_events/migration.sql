-- CreateTable
CREATE TABLE "CancellationEvent" (
    "id" TEXT NOT NULL,
    "cancellationRequestId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CancellationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CancellationEvent_cancellationRequestId_idx" ON "CancellationEvent"("cancellationRequestId");

-- CreateIndex
CREATE INDEX "CancellationEvent_type_idx" ON "CancellationEvent"("type");

-- CreateIndex
CREATE INDEX "CancellationEvent_createdAt_idx" ON "CancellationEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "CancellationEvent" ADD CONSTRAINT "CancellationEvent_cancellationRequestId_fkey" FOREIGN KEY ("cancellationRequestId") REFERENCES "CancellationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
