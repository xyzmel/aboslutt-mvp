CREATE TABLE IF NOT EXISTS "UnmatchedProviderSignal" (
    "id" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnmatchedProviderSignal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UnmatchedProviderSignal_normalizedName_key"
ON "UnmatchedProviderSignal"("normalizedName");

CREATE INDEX IF NOT EXISTS "UnmatchedProviderSignal_count_idx"
ON "UnmatchedProviderSignal"("count");

CREATE INDEX IF NOT EXISTS "UnmatchedProviderSignal_lastSeenAt_idx"
ON "UnmatchedProviderSignal"("lastSeenAt");
