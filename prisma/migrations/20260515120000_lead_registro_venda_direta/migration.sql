-- CreateEnum
CREATE TYPE "LeadRegistro" AS ENUM ('oportunidade', 'venda_direta_financeiro');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "registroLead" "LeadRegistro" NOT NULL DEFAULT 'oportunidade';

CREATE INDEX "Lead_registroLead_idx" ON "Lead"("registroLead");
