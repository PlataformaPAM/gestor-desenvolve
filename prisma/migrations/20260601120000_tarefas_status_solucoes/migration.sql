-- Renomeia impedimento → aguardando e adiciona novos status do kanban.
ALTER TYPE "TarefaStatus" RENAME VALUE 'impedimento' TO 'aguardando';

ALTER TYPE "TarefaStatus" ADD VALUE IF NOT EXISTS 'validar';
ALTER TYPE "TarefaStatus" ADD VALUE IF NOT EXISTS 'cancelado';

-- TarefaCliente (N:N) — idempotente para produção.
CREATE TABLE IF NOT EXISTS "TarefaCliente" (
    "id" TEXT NOT NULL,
    "tarefaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TarefaCliente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TarefaCliente_tarefaId_clienteId_key" ON "TarefaCliente"("tarefaId", "clienteId");

DO $$ BEGIN
  ALTER TABLE "TarefaCliente"
    ADD CONSTRAINT "TarefaCliente_tarefaId_fkey"
    FOREIGN KEY ("tarefaId") REFERENCES "Tarefa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TarefaCliente"
    ADD CONSTRAINT "TarefaCliente_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Audit em Tarefa
ALTER TABLE "Tarefa" ADD COLUMN IF NOT EXISTS "criadoPorId" TEXT;
ALTER TABLE "Tarefa" ADD COLUMN IF NOT EXISTS "atualizadoPorId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Tarefa"
    ADD CONSTRAINT "Tarefa_criadoPorId_fkey"
    FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Tarefa"
    ADD CONSTRAINT "Tarefa_atualizadoPorId_fkey"
    FOREIGN KEY ("atualizadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Soluções vinculadas (N:N)
CREATE TABLE IF NOT EXISTS "TarefaSolucao" (
    "id" TEXT NOT NULL,
    "tarefaId" TEXT NOT NULL,
    "solucaoCatalogoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TarefaSolucao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TarefaSolucao_tarefaId_solucaoCatalogoId_key"
  ON "TarefaSolucao"("tarefaId", "solucaoCatalogoId");

DO $$ BEGIN
  ALTER TABLE "TarefaSolucao"
    ADD CONSTRAINT "TarefaSolucao_tarefaId_fkey"
    FOREIGN KEY ("tarefaId") REFERENCES "Tarefa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TarefaSolucao"
    ADD CONSTRAINT "TarefaSolucao_solucaoCatalogoId_fkey"
    FOREIGN KEY ("solucaoCatalogoId") REFERENCES "SolucaoCatalogo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Reatribui códigos sequenciais por ano de criação (TAR-YYYY-NNNN).
WITH ranked AS (
  SELECT
    t."id",
    EXTRACT(YEAR FROM t."createdAt")::INT AS ano,
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(YEAR FROM t."createdAt")
      ORDER BY t."createdAt", t."id"
    ) AS seq
  FROM "Tarefa" t
)
UPDATE "Tarefa" t
SET "codigo" = CONCAT('TAR-', ranked.ano::TEXT, '-', LPAD(ranked.seq::TEXT, 4, '0'))
FROM ranked
WHERE ranked."id" = t."id";
