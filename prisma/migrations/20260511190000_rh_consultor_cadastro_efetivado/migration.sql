-- Pré-cadastro de consultores: cadastroEfetivado = false até fechamento do acordo.
ALTER TABLE "ColaboradorRH" ADD COLUMN "cadastroEfetivado" BOOLEAN NOT NULL DEFAULT true;
