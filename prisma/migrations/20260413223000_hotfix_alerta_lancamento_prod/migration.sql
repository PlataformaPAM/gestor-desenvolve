-- Hotfix de produção para ambientes com schema desatualizado.
-- Seguro para reexecução (usa IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "Alerta" (
  "id" TEXT NOT NULL,
  "modulo" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "descricao" TEXT NOT NULL,
  "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lida" BOOLEAN NOT NULL DEFAULT false,
  "usuarioId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Alerta_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Lancamento"
ADD COLUMN IF NOT EXISTS "leadSolucaoId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Alerta_usuarioId_fkey'
  ) THEN
    ALTER TABLE "Alerta"
    ADD CONSTRAINT "Alerta_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Lancamento_leadSolucaoId_fkey'
  ) THEN
    ALTER TABLE "Lancamento"
    ADD CONSTRAINT "Lancamento_leadSolucaoId_fkey"
    FOREIGN KEY ("leadSolucaoId") REFERENCES "LeadSolucao"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Alerta_data_idx" ON "Alerta"("data");
CREATE INDEX IF NOT EXISTS "Alerta_modulo_idx" ON "Alerta"("modulo");
CREATE INDEX IF NOT EXISTS "Alerta_usuarioId_idx" ON "Alerta"("usuarioId");
CREATE INDEX IF NOT EXISTS "Lancamento_leadSolucaoId_idx" ON "Lancamento"("leadSolucaoId");
