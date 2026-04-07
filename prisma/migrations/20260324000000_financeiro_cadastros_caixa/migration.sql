-- CreateEnum
CREATE TYPE "FinanceiroCategoriaTipo" AS ENUM ('entrada', 'saida', 'ambos');

-- CreateTable
CREATE TABLE "FinanceiroConta" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "saldoInicial" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceiroConta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceiroCategoria" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "FinanceiroCategoriaTipo" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceiroCategoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceiroMeioPagamento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceiroMeioPagamento_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Lancamento" ADD COLUMN     "contaId" TEXT,
ADD COLUMN     "categoriaId" TEXT,
ADD COLUMN     "meioPagamentoId" TEXT;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "FinanceiroConta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "FinanceiroCategoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_meioPagamentoId_fkey" FOREIGN KEY ("meioPagamentoId") REFERENCES "FinanceiroMeioPagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
