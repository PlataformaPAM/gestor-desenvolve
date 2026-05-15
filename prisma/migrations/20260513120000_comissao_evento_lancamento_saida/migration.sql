-- Vincula saída de caixa ao pagamento de comissão (fluxo de caixa + idempotência).
ALTER TABLE "ComissaoEvento" ADD COLUMN IF NOT EXISTS "lancamentoSaidaId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ComissaoEvento_lancamentoSaidaId_key"
  ON "ComissaoEvento"("lancamentoSaidaId");

DO $$ BEGIN
  ALTER TABLE "ComissaoEvento"
    ADD CONSTRAINT "ComissaoEvento_lancamentoSaidaId_fkey"
    FOREIGN KEY ("lancamentoSaidaId") REFERENCES "Lancamento"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
