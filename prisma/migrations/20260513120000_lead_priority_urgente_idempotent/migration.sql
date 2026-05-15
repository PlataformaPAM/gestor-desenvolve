-- Idempotente: adiciona `urgente` ao enum se ainda não existir (DBs sem a migração 20260505140000).
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_enum e
    INNER JOIN pg_catalog.pg_type t ON e.enumtypid = t.oid
    INNER JOIN pg_catalog.pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = current_schema()
      AND t.typname = 'LeadPriority'
      AND e.enumlabel = 'urgente'
  ) THEN
    ALTER TYPE "LeadPriority" ADD VALUE 'urgente';
  END IF;
END
$enum$;
