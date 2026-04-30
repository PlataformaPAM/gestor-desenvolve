ALTER TABLE "Tarefa"
ADD COLUMN IF NOT EXISTS "codigo" TEXT;

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
WHERE ranked."id" = t."id"
  AND t."codigo" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Tarefa_codigo_key" ON "Tarefa"("codigo");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Tarefa" WHERE "codigo" IS NULL) THEN
    RAISE EXCEPTION 'Existem tarefas sem codigo após backfill.';
  END IF;
END $$;

ALTER TABLE "Tarefa"
ALTER COLUMN "codigo" SET NOT NULL;
