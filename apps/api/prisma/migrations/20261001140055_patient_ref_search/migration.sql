-- AlterTable
ALTER TABLE "Scan" ADD COLUMN     "patientRefHash" TEXT;

-- CreateIndex
CREATE INDEX "Scan_userId_patientRefHash_idx" ON "Scan"("userId", "patientRefHash");
