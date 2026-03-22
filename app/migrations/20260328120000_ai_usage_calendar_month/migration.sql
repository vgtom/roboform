-- Calendar-month AI tracking (superseded by 20260329120000_ai_usage_billing_period).
-- IF NOT EXISTS: safe if this migration was never applied or partially applied.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "aiUsageCalendarMonth" TEXT;
