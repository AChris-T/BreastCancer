-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "aiReasoning" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "aiSubtype" TEXT NOT NULL DEFAULT 'UNDETERMINED',
ALTER COLUMN "riskLevel" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Scan" ADD COLUMN     "classification" TEXT NOT NULL DEFAULT 'UNDETERMINED',
ADD COLUMN     "clinicalDetails" TEXT;
