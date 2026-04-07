/**
 * Remove dados operacionais (Comercial, Clientes, Financeiro lançamentos, Helpdesk,
 * Tarefas internas e de pós-venda, Alertas, etc.), preservando:
 *
 * - Usuario, UsuarioVinculo (perfis de acesso continuam)
 * - PerfilAcesso, PerfilPermissao
 * - LogSistema (histórico exibido em Configurações)
 * - ColaboradorRH e relacionados (RH e Parceiros), por padrão TODOS os registros.
 *
 * Opcional: manter somente a aba "Equipe Interna (CLT/PJ)" no RH:
 *   RESET_RH_EQUIPE_INTERNA_ONLY=1
 *
 * Uso (PowerShell):
 *   $env:CONFIRM_RESET_DADOS="LIMPAR_OPERACIONAL"; node prisma/reset-dados-operacionais.mjs
 *
 * Uso (bash):
 *   CONFIRM_RESET_DADOS=LIMPAR_OPERACIONAL node prisma/reset-dados-operacionais.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function loadDatabaseUrlFromEnvFiles() {
  if (process.env.DATABASE_URL) return;
  for (const name of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    const lines = readFileSync(p, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const m = t.match(/^DATABASE_URL\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[1].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      process.env.DATABASE_URL = v;
      return;
    }
  }
}

loadDatabaseUrlFromEnvFiles();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL não definida.");
  process.exit(1);
}

if (process.env.CONFIRM_RESET_DADOS !== "LIMPAR_OPERACIONAL") {
  console.error(
    'Para executar, defina CONFIRM_RESET_DADOS=LIMPAR_OPERACIONAL (proteção contra execução acidental).'
  );
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const onlyEquipeInterna = process.env.RESET_RH_EQUIPE_INTERNA_ONLY === "1";

async function resetRhOptional(tx) {
  if (!onlyEquipeInterna) return;
  const removidos = await tx.colaboradorRH.findMany({
    where: { tipoPessoa: { not: "equipe_interna" } },
    select: { id: true },
  });
  const ids = removidos.map((r) => r.id);
  if (ids.length === 0) return;
  await tx.usuarioVinculo.deleteMany({
    where: { tipo: "rh", pessoaId: { in: ids } },
  });
  await tx.usuario.updateMany({
    where: {
      vinculacaoTipo: "rh",
      vinculacaoPessoaId: { in: ids },
    },
    data: { vinculacaoTipo: null, vinculacaoPessoaId: null },
  });
  await tx.colaboradorRH.deleteMany({ where: { id: { in: ids } } });
  console.log(`RH: removidos ${ids.length} colaboradores (mantida apenas Equipe Interna).`);
}

async function main() {
  console.log("Iniciando limpeza operacional…");
  await prisma.$transaction(
    async (tx) => {
      await resetRhOptional(tx);

      await tx.logSistema.deleteMany();
      await tx.alerta.deleteMany();

      await tx.helpdeskComentarioAnexo.deleteMany();
      await tx.helpdeskComentario.deleteMany();
      await tx.helpdeskHistoricoAnexo.deleteMany();
      await tx.helpdeskHistorico.deleteMany();
      await tx.helpdeskTicketResponsavel.deleteMany();
      await tx.helpdeskAnexo.deleteMany();
      await tx.helpdeskTicket.deleteMany();

      await tx.tarefaHistoricoAnexo.deleteMany();
      await tx.tarefaHistorico.deleteMany();
      await tx.tarefaAnexo.deleteMany();
      await tx.tarefaColaborador.deleteMany();
      await tx.tarefa.deleteMany();

      await tx.lancamento.deleteMany();

      await tx.leadInteractionAnexo.deleteMany();
      await tx.leadInteraction.deleteMany();

      await tx.contratoItem.deleteMany();
      await tx.contrato.deleteMany();

      await tx.leadFinanceiroFluxo.deleteMany();
      await tx.leadContratoArquivo.deleteMany();
      await tx.leadContratoChecklist.deleteMany();
      await tx.leadChecklistItem.deleteMany();
      await tx.leadContatoPapel.deleteMany();
      await tx.leadContato.deleteMany();
      await tx.leadSolucao.deleteMany();
      await tx.lead.deleteMany();

      await tx.solucaoCatalogo.deleteMany();

      await tx.clienteContatoPapel.deleteMany();
      await tx.clienteContato.deleteMany();
      await tx.clienteEndereco.deleteMany();
      await tx.clienteProposta.deleteMany();
      await tx.clienteFatura.deleteMany();
      await tx.clienteTicketResumo.deleteMany();
      await tx.cliente.deleteMany();

      await tx.financeiroMeioPagamento.deleteMany();
      await tx.financeiroCategoria.deleteMany();
      await tx.financeiroConta.deleteMany();

      await tx.usuarioVinculo.deleteMany({ where: { tipo: "cliente" } });
      await tx.usuario.updateMany({
        where: { vinculacaoTipo: "cliente" },
        data: { vinculacaoTipo: null, vinculacaoPessoaId: null },
      });
    },
    { timeout: 300_000 }
  );

  console.log("Limpeza concluída. Preservados: usuários, perfis, permissões, logs de sistema, RH.");
  if (!onlyEquipeInterna) {
    console.log("Colaboradores RH: todos os tipos preservados.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
