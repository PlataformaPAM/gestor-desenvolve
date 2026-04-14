-- Hotfix produção: colunas faltantes em Lancamento
-- Seguro para reexecução

ALTER TABLE "Lancamento"
ADD COLUMN IF NOT EXISTS "criadoPorId" TEXT;

ALTER TABLE "Lancamento"
ADD COLUMN IF NOT EXISTS "atualizadoPorId" TEXT;

ALTER TABLE "Lancamento"
ADD COLUMN IF NOT EXISTS "leadSolucaoId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Lancamento_criadoPorId_fkey'
  ) THEN
    ALTER TABLE "Lancamento"
    ADD CONSTRAINT "Lancamento_criadoPorId_fkey"
    FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Lancamento_atualizadoPorId_fkey'
  ) THEN
    ALTER TABLE "Lancamento"
    ADD CONSTRAINT "Lancamento_atualizadoPorId_fkey"
    FOREIGN KEY ("atualizadoPorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Lancamento_leadSolucaoId_fkey'
  ) THEN
    ALTER TABLE "Lancamento"
    ADD CONSTRAINT "Lancamento_leadSolucaoId_fkey"
    FOREIGN KEY ("leadSolucaoId") REFERENCES "LeadSolucao"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Lancamento_criadoPorId_idx" ON "Lancamento"("criadoPorId");
CREATE INDEX IF NOT EXISTS "Lancamento_atualizadoPorId_idx" ON "Lancamento"("atualizadoPorId");
CREATE INDEX IF NOT EXISTS "Lancamento_leadSolucaoId_idx" ON "Lancamento"("leadSolucaoId");