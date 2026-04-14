-- Hotfix produção: colunas de auditoria ausentes em Cliente
-- Seguro para reexecução

ALTER TABLE "Cliente"
ADD COLUMN IF NOT EXISTS "criadoPorId" TEXT;

ALTER TABLE "Cliente"
ADD COLUMN IF NOT EXISTS "atualizadoPorId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Cliente_criadoPorId_fkey'
  ) THEN
    ALTER TABLE "Cliente"
    ADD CONSTRAINT "Cliente_criadoPorId_fkey"
    FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Cliente_atualizadoPorId_fkey'
  ) THEN
    ALTER TABLE "Cliente"
    ADD CONSTRAINT "Cliente_atualizadoPorId_fkey"
    FOREIGN KEY ("atualizadoPorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Cliente_criadoPorId_idx" ON "Cliente"("criadoPorId");
CREATE INDEX IF NOT EXISTS "Cliente_atualizadoPorId_idx" ON "Cliente"("atualizadoPorId");