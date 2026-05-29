-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "responsavelPrincipalId" TEXT,
ADD COLUMN     "responsavelPrincipalNome" TEXT,
ADD COLUMN     "colaboradores" JSONB;
