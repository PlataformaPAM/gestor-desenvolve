-- Núcleo de comissões: regras, participações, eventos e lotes de pagamento.
ALTER TABLE "SolucaoCatalogo" ADD COLUMN IF NOT EXISTS "categoria" TEXT;

DO $$ BEGIN
  CREATE TYPE "ComissaoBaseCalculo" AS ENUM ('bruto', 'liquido');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ComissaoStatus" AS ENUM ('prevista', 'elegivel', 'aprovada', 'paga', 'cancelada_tecnica');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ComissaoRegra" (
  "id" TEXT NOT NULL,
  "consultorId" TEXT NOT NULL,
  "solucaoCatalogoId" TEXT,
  "categoriaSolucao" TEXT,
  "baseCalculo" "ComissaoBaseCalculo" NOT NULL DEFAULT 'bruto',
  "percentualComissao" DECIMAL(7,4) NOT NULL,
  "despesaFixa" DECIMAL(14,2),
  "vigenciaInicio" TIMESTAMP(3) NOT NULL,
  "vigenciaFim" TIMESTAMP(3),
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "prioridade" INTEGER NOT NULL DEFAULT 0,
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComissaoRegra_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ComissaoParticipacaoVenda" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "leadSolucaoId" TEXT,
  "consultorId" TEXT NOT NULL,
  "percentualParticipacao" DECIMAL(7,4) NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComissaoParticipacaoVenda_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ComissaoLotePagamento" (
  "id" TEXT NOT NULL,
  "competenciaAno" INTEGER NOT NULL,
  "competenciaMes" INTEGER NOT NULL,
  "observacao" TEXT,
  "referenciaExterna" TEXT,
  "pagoEm" TIMESTAMP(3),
  "criadoPorId" TEXT,
  "atualizadoPorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComissaoLotePagamento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ComissaoEvento" (
  "id" TEXT NOT NULL,
  "status" "ComissaoStatus" NOT NULL DEFAULT 'elegivel',
  "competenciaAno" INTEGER NOT NULL,
  "competenciaMes" INTEGER NOT NULL,
  "dataRecebimento" TIMESTAMP(3) NOT NULL,
  "origemLancamentoId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "leadSolucaoId" TEXT,
  "consultorId" TEXT NOT NULL,
  "regraId" TEXT,
  "participacaoId" TEXT,
  "lotePagamentoId" TEXT,
  "baseCalculo" "ComissaoBaseCalculo" NOT NULL DEFAULT 'bruto',
  "percentualComissao" DECIMAL(7,4) NOT NULL,
  "percentualParticipacao" DECIMAL(7,4) NOT NULL,
  "despesaFixa" DECIMAL(14,2),
  "valorBase" DECIMAL(14,2) NOT NULL,
  "valorComissao" DECIMAL(14,2) NOT NULL,
  "observacao" TEXT,
  "aprovadoEm" TIMESTAMP(3),
  "pagoEm" TIMESTAMP(3),
  "canceladoEm" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComissaoEvento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "comissao_participacao_un"
  ON "ComissaoParticipacaoVenda"("leadId", "leadSolucaoId", "consultorId");
CREATE UNIQUE INDEX IF NOT EXISTS "comissao_evento_lanc_cons_un"
  ON "ComissaoEvento"("origemLancamentoId", "consultorId");

CREATE INDEX IF NOT EXISTS "ComissaoRegra_consultorId_ativo_vigenciaInicio_vigenciaFim_idx"
  ON "ComissaoRegra"("consultorId", "ativo", "vigenciaInicio", "vigenciaFim");
CREATE INDEX IF NOT EXISTS "ComissaoRegra_solucaoCatalogoId_idx"
  ON "ComissaoRegra"("solucaoCatalogoId");
CREATE INDEX IF NOT EXISTS "ComissaoRegra_categoriaSolucao_idx"
  ON "ComissaoRegra"("categoriaSolucao");
CREATE INDEX IF NOT EXISTS "ComissaoParticipacaoVenda_leadId_ativo_idx"
  ON "ComissaoParticipacaoVenda"("leadId", "ativo");
CREATE INDEX IF NOT EXISTS "ComissaoParticipacaoVenda_leadSolucaoId_ativo_idx"
  ON "ComissaoParticipacaoVenda"("leadSolucaoId", "ativo");
CREATE INDEX IF NOT EXISTS "ComissaoLotePagamento_competenciaAno_competenciaMes_idx"
  ON "ComissaoLotePagamento"("competenciaAno", "competenciaMes");
CREATE INDEX IF NOT EXISTS "ComissaoEvento_competenciaAno_competenciaMes_status_idx"
  ON "ComissaoEvento"("competenciaAno", "competenciaMes", "status");
CREATE INDEX IF NOT EXISTS "ComissaoEvento_consultorId_status_idx"
  ON "ComissaoEvento"("consultorId", "status");
CREATE INDEX IF NOT EXISTS "ComissaoEvento_leadId_idx"
  ON "ComissaoEvento"("leadId");

DO $$ BEGIN
  ALTER TABLE "ComissaoRegra"
    ADD CONSTRAINT "ComissaoRegra_consultorId_fkey"
    FOREIGN KEY ("consultorId") REFERENCES "ColaboradorRH"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ComissaoRegra"
    ADD CONSTRAINT "ComissaoRegra_solucaoCatalogoId_fkey"
    FOREIGN KEY ("solucaoCatalogoId") REFERENCES "SolucaoCatalogo"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ComissaoParticipacaoVenda"
    ADD CONSTRAINT "ComissaoParticipacaoVenda_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ComissaoParticipacaoVenda"
    ADD CONSTRAINT "ComissaoParticipacaoVenda_leadSolucaoId_fkey"
    FOREIGN KEY ("leadSolucaoId") REFERENCES "LeadSolucao"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ComissaoParticipacaoVenda"
    ADD CONSTRAINT "ComissaoParticipacaoVenda_consultorId_fkey"
    FOREIGN KEY ("consultorId") REFERENCES "ColaboradorRH"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ComissaoLotePagamento"
    ADD CONSTRAINT "ComissaoLotePagamento_criadoPorId_fkey"
    FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ComissaoLotePagamento"
    ADD CONSTRAINT "ComissaoLotePagamento_atualizadoPorId_fkey"
    FOREIGN KEY ("atualizadoPorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ComissaoEvento"
    ADD CONSTRAINT "ComissaoEvento_origemLancamentoId_fkey"
    FOREIGN KEY ("origemLancamentoId") REFERENCES "Lancamento"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ComissaoEvento"
    ADD CONSTRAINT "ComissaoEvento_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ComissaoEvento"
    ADD CONSTRAINT "ComissaoEvento_leadSolucaoId_fkey"
    FOREIGN KEY ("leadSolucaoId") REFERENCES "LeadSolucao"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ComissaoEvento"
    ADD CONSTRAINT "ComissaoEvento_consultorId_fkey"
    FOREIGN KEY ("consultorId") REFERENCES "ColaboradorRH"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ComissaoEvento"
    ADD CONSTRAINT "ComissaoEvento_regraId_fkey"
    FOREIGN KEY ("regraId") REFERENCES "ComissaoRegra"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ComissaoEvento"
    ADD CONSTRAINT "ComissaoEvento_participacaoId_fkey"
    FOREIGN KEY ("participacaoId") REFERENCES "ComissaoParticipacaoVenda"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ComissaoEvento"
    ADD CONSTRAINT "ComissaoEvento_lotePagamentoId_fkey"
    FOREIGN KEY ("lotePagamentoId") REFERENCES "ComissaoLotePagamento"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
