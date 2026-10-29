CREATE TABLE "ResearchBatch" (
 "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "status" TEXT NOT NULL DEFAULT 'running', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "ResearchBatch_userId_createdAt_idx" ON "ResearchBatch"("userId", "createdAt");
CREATE TABLE "ResearchJob" (
 "id" TEXT NOT NULL PRIMARY KEY, "batchId" TEXT NOT NULL REFERENCES "ResearchBatch"("id") ON DELETE CASCADE,
 "leadId" TEXT NOT NULL REFERENCES "Lead"("id") ON DELETE CASCADE, "status" TEXT NOT NULL DEFAULT 'queued',
 "attempts" INTEGER NOT NULL DEFAULT 0, "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "leaseUntil" TIMESTAMP(3), "leaseToken" TEXT, "error" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 UNIQUE ("batchId", "leadId")
);
CREATE INDEX "ResearchJob_status_availableAt_idx" ON "ResearchJob"("status", "availableAt");
CREATE TABLE "ResearchCandidate" (
 "id" TEXT NOT NULL PRIMARY KEY, "jobId" TEXT NOT NULL REFERENCES "ResearchJob"("id") ON DELETE CASCADE,
 "businessName" TEXT, "website" TEXT NOT NULL, "phoneMatched" BOOLEAN NOT NULL,
 "confidence" INTEGER NOT NULL, "evidence" JSONB NOT NULL, "reviewedAt" TIMESTAMP(3), "decision" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ResearchCandidate_jobId_idx" ON "ResearchCandidate"("jobId");
CREATE TABLE "ResearchLog" (
 "id" TEXT NOT NULL PRIMARY KEY, "jobId" TEXT NOT NULL REFERENCES "ResearchJob"("id") ON DELETE CASCADE,
 "stage" TEXT NOT NULL, "message" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ResearchLog_jobId_createdAt_idx" ON "ResearchLog"("jobId", "createdAt");
CREATE TABLE "SearchUsage" (
 "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "month" TEXT NOT NULL, "requests" INTEGER NOT NULL DEFAULT 0, UNIQUE ("userId", "month")
);
