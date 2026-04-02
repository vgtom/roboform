-- Starter plan: track submissions in current billing period (resets with AI usage period).
ALTER TABLE "User" ADD COLUMN "submissionUsageCount" INTEGER NOT NULL DEFAULT 0;
