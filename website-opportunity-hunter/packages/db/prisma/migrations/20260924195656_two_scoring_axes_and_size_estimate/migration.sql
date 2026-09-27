-- CreateEnum
CREATE TYPE "ScoreAxis" AS ENUM ('WEBSITE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SizeBand" AS ENUM ('MICRO', 'SMALL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "SizeFit" AS ENUM ('LIKELY', 'POSSIBLE', 'UNLIKELY', 'UNKNOWN');

-- DropIndex
DROP INDEX "scores_companyId_computedAt_idx";

-- DropIndex
DROP INDEX "scores_score_idx";

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "capitalSocial" DECIMAL(18,2),
ADD COLUMN     "porte" VARCHAR(2),
ADD COLUMN     "sizeBand" "SizeBand",
ADD COLUMN     "sizeBasis" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sizeConfidence" "Confidence",
ADD COLUMN     "sizeEmployeesFrom" INTEGER,
ADD COLUMN     "sizeEmployeesTo" INTEGER,
ADD COLUMN     "sizeFit" "SizeFit",
ADD COLUMN     "systemClassification" "Classification",
ADD COLUMN     "systemScore" INTEGER,
ADD COLUMN     "systemScoredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "scores" ADD COLUMN     "axis" "ScoreAxis" NOT NULL DEFAULT 'WEBSITE';

-- CreateIndex
CREATE INDEX "companies_systemScore_idx" ON "companies"("systemScore");

-- CreateIndex
CREATE INDEX "companies_systemClassification_idx" ON "companies"("systemClassification");

-- CreateIndex
CREATE INDEX "companies_sizeBand_idx" ON "companies"("sizeBand");

-- CreateIndex
CREATE INDEX "scores_companyId_axis_computedAt_idx" ON "scores"("companyId", "axis", "computedAt");

-- CreateIndex
CREATE INDEX "scores_axis_score_idx" ON "scores"("axis", "score");
