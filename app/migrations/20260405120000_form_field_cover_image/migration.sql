-- CreateTable
CREATE TABLE "FormFieldCoverImage" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "formId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "imageData" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,

    CONSTRAINT "FormFieldCoverImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormFieldCoverImage_formId_fieldId_key" ON "FormFieldCoverImage"("formId", "fieldId");

-- CreateIndex
CREATE INDEX "FormFieldCoverImage_formId_idx" ON "FormFieldCoverImage"("formId");

-- AddForeignKey
ALTER TABLE "FormFieldCoverImage" ADD CONSTRAINT "FormFieldCoverImage_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
