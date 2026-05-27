-- Sincroniza objetos presentes no schema Prisma mas sem migration anterior.
-- Idempotente: seguro para rodar em produção atrasada ou repetidamente.

-- Lead.registroLead (caso 20260515120000 ainda não tenha sido aplicada)
DO $$ BEGIN
  CREATE TYPE "LeadRegistro" AS ENUM ('oportunidade', 'venda_direta_financeiro');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "registroLead" "LeadRegistro" NOT NULL DEFAULT 'oportunidade';
CREATE INDEX IF NOT EXISTS "Lead_registroLead_idx" ON "Lead"("registroLead");

-- Lead audit (criado/atualizado por)
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "criadoPorId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "atualizadoPorId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Lead"
    ADD CONSTRAINT "Lead_criadoPorId_fkey"
    FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Lead"
    ADD CONSTRAINT "Lead_atualizadoPorId_fkey"
    FOREIGN KEY ("atualizadoPorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "Lead_criadoPorId_idx" ON "Lead"("criadoPorId");
CREATE INDEX IF NOT EXISTS "Lead_atualizadoPorId_idx" ON "Lead"("atualizadoPorId");

-- LeadInteraction.autorNome
ALTER TABLE "LeadInteraction" ADD COLUMN IF NOT EXISTS "autorNome" TEXT;

-- LeadSolucao.recorrenciaPagamento
DO $$ BEGIN
  CREATE TYPE "LeadSolucaoRecorrenciaPagamento" AS ENUM ('mensal', 'unica', 'parcelado');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "LeadSolucao" ADD COLUMN IF NOT EXISTS "recorrenciaPagamento" "LeadSolucaoRecorrenciaPagamento";

-- UsuarioVinculo (múltiplos vínculos por usuário)
CREATE TABLE IF NOT EXISTS "UsuarioVinculo" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "tipo" "PessoaVinculoTipo" NOT NULL,
  "pessoaId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsuarioVinculo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UsuarioVinculo_usuarioId_tipo_pessoaId_key"
  ON "UsuarioVinculo"("usuarioId", "tipo", "pessoaId");

DO $$ BEGIN
  ALTER TABLE "UsuarioVinculo"
    ADD CONSTRAINT "UsuarioVinculo_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Backfill a partir das colunas legadas vinculacaoTipo / vinculacaoPessoaId
INSERT INTO "UsuarioVinculo" ("id", "usuarioId", "tipo", "pessoaId", "createdAt", "updatedAt")
SELECT
  md5(u."id" || '|' || u."vinculacaoTipo"::text || '|' || u."vinculacaoPessoaId"),
  u."id",
  u."vinculacaoTipo",
  u."vinculacaoPessoaId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Usuario" u
WHERE u."vinculacaoTipo" IS NOT NULL
  AND u."vinculacaoPessoaId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "UsuarioVinculo" v
    WHERE v."usuarioId" = u."id"
      AND v."tipo" = u."vinculacaoTipo"
      AND v."pessoaId" = u."vinculacaoPessoaId"
  );

-- PerfilAcesso.permissoesGranulares (caso 20260518200000 ainda não tenha sido aplicada)
ALTER TABLE "PerfilAcesso" ADD COLUMN IF NOT EXISTS "permissoesGranulares" JSONB;
