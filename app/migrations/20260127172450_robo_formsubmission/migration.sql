-- AlterTable
ALTER TABLE "FormResponse" ALTER COLUMN "responseJson" DROP NOT NULL;

-- CreateTable
CREATE TABLE "FormResponseField" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submissionId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "value" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "valueBoolean" BOOLEAN,
    "valueDate" TIMESTAMP(3),
    "valueJson" JSONB,

    CONSTRAINT "FormResponseField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormResponseField_submissionId_idx" ON "FormResponseField"("submissionId");

-- CreateIndex
CREATE INDEX "FormResponseField_formId_idx" ON "FormResponseField"("formId");

-- CreateIndex
CREATE INDEX "FormResponseField_fieldId_idx" ON "FormResponseField"("fieldId");

-- CreateIndex
CREATE INDEX "FormResponseField_fieldType_idx" ON "FormResponseField"("fieldType");

-- CreateIndex
CREATE INDEX "FormResponseField_formId_fieldId_idx" ON "FormResponseField"("formId", "fieldId");

-- CreateIndex
CREATE INDEX "FormResponseField_createdAt_idx" ON "FormResponseField"("createdAt");

-- CreateIndex
CREATE INDEX "FormResponse_createdAt_idx" ON "FormResponse"("createdAt");

-- AddForeignKey
ALTER TABLE "FormResponseField" ADD CONSTRAINT "FormResponseField_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormResponseField" ADD CONSTRAINT "FormResponseField_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
