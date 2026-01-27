/*
  Warnings:

  - You are about to drop the column `aiUsageCost` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "aiUsageCost",
ADD COLUMN     "aiUsageCount" INTEGER NOT NULL DEFAULT 0;
