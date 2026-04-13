-- CreateEnum
CREATE TYPE "DocumentoModeloTipo" AS ENUM ('proposta_comercial', 'oficio', 'prestacao_contas', 'relatorio');

-- CreateTable
CREATE TABLE "DocumentoModelo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "DocumentoModeloTipo" NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "assunto" TEXT NOT NULL DEFAULT '',
    "corpo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentoModelo_pkey" PRIMARY KEY ("id")
);
