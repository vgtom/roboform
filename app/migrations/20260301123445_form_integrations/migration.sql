-- CreateTable
CREATE TABLE "FormIntegration" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "formId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "configJson" JSONB,

    CONSTRAINT "FormIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormIntegration_formId_idx" ON "FormIntegration"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "FormIntegration_formId_provider_key" ON "FormIntegration"("formId", "provider");

-- AddForeignKey
ALTER TABLE "FormIntegration" ADD CONSTRAINT "FormIntegration_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
