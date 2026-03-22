-- Align AI quota with Lemon subscription billing period (renews_at / ends_at)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lemonSubscriptionId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "aiUsagePeriodEndsAt" TIMESTAMP(3);
ALTER TABLE "User" DROP COLUMN IF EXISTS "aiUsageCalendarMonth";
