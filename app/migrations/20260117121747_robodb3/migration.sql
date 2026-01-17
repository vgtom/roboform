/*
  Warnings:

  - You are about to drop the column `aiUsageCount` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "aiUsageCount",
ADD COLUMN     "aiUsageCost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ALTER COLUMN "credits" SET DEFAULT 5;
