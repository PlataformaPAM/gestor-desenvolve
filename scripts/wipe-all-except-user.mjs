#!/usr/bin/env node
/**
 * Apaga praticamente todos os dados do banco (PostgreSQL via Prisma), mantendo
 * um único usuário identificado pelo CPF (apenas dígitos) e o perfil de acesso
 * vinculado a ele.
 *
 * DESTRUTIVO. Faça backup antes (ex.: npm run backup:full).
 *
 * Uso (na raiz do repositório, PowerShell):
 *   $env:CONFIRM="YES"; node scripts/wipe-all-except-user.mjs
 *
 * bash:
 *   CONFIRM=YES node scripts/wipe-all-except-user.mjs
 *
 * Opcional: CPF_PROTEGIDO=07202188961 (padrão = 07202188961)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const PROTECTED_CPF_DIGITS = (process.env.CPF_PROTEGIDO ?? "07202188961").replace(/\D/g, "");

function loadDatabaseUrlFromEnvFiles() {
  if (process.env.DATABASE_URL?.trim()) return;
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

function normalizeCpf(cpf) {
  return String(cpf ?? "").replace(/\D/g, "");
}

async function main() {
  if (process.env.CONFIRM !== "YES") {
    console.error(
      "Abortado: defina CONFIRM=YES para executar (ex.: $env:CONFIRM=\"YES\"; node scripts/wipe-all-except-user.mjs)."
    );
    process.exit(1);
  }

  if (!PROTECTED_CPF_DIGITS || PROTECTED_CPF_DIGITS.length !== 11) {
    console.error("CPF protegido inválido após normalizar dígitos.");
    process.exit(1);
  }

  loadDatabaseUrlFromEnvFiles();

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    console.error("DATABASE_URL não definida (.env / .env.local).");
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const allUsers = await prisma.usuario.findMany({
    select: { id: true, cpf: true, email: true, nomeExibicao: true, perfilId: true, ativo: true },
  });
  const protectedUser = allUsers.find((u) => normalizeCpf(u.cpf) === PROTECTED_CPF_DIGITS);

  if (!protectedUser) {
    console.error(
      `Nenhum usuário encontrado com CPF (dígitos) ${PROTECTED_CPF_DIGITS}. Nada foi alterado.`
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(
    `Usuário protegido: ${protectedUser.email} (${protectedUser.nomeExibicao ?? "sem nome"}) id=${protectedUser.id}`
  );

  const protectedId = protectedUser.id;
  const protectedPerfilId = protectedUser.perfilId;

  await prisma.$transaction(
    async (tx) => {
      await tx.lancamento.deleteMany({});
      await tx.comissaoParticipacaoVenda.deleteMany({});
      await tx.comissaoRegra.deleteMany({});
      await tx.comissaoLotePagamento.deleteMany({});

      await tx.contratoAditivo.deleteMany({});
      await tx.contratoItem.deleteMany({});
      await tx.contrato.deleteMany({});

      await tx.leadInteractionAnexo.deleteMany({});
      await tx.leadInteraction.deleteMany({});
      await tx.leadContratoArquivo.deleteMany({});
      await tx.leadContratoChecklist.deleteMany({});
      await tx.leadChecklistItem.deleteMany({});
      await tx.leadContatoPapel.deleteMany({});
      await tx.leadContato.deleteMany({});
      await tx.leadSolucao.deleteMany({});
      await tx.leadFinanceiroFluxo.deleteMany({});
      await tx.lead.deleteMany({});

      await tx.helpdeskTicketResponsavel.deleteMany({});
      await tx.helpdeskComentarioAnexo.deleteMany({});
      await tx.helpdeskComentario.deleteMany({});
      await tx.helpdeskHistoricoAnexo.deleteMany({});
      await tx.helpdeskHistorico.deleteMany({});
      await tx.helpdeskAnexo.deleteMany({});
      await tx.helpdeskTicket.deleteMany({});

      await tx.tarefaHistoricoAnexo.deleteMany({});
      await tx.tarefaHistorico.deleteMany({});
      await tx.tarefaAnexo.deleteMany({});
      await tx.tarefaColaborador.deleteMany({});
      await tx.tarefaCliente.deleteMany({});
      await tx.tarefa.deleteMany({});

      await tx.cliente.deleteMany({});

      await tx.solucaoCatalogo.deleteMany({});

      await tx.colaboradorRH.deleteMany({});

      await tx.usuarioVinculo.deleteMany({});

      await tx.alerta.deleteMany({});
      await tx.logSistema.deleteMany({});
      await tx.configuracaoSistema.deleteMany({});
      await tx.documentoModelo.deleteMany({});

      await tx.financeiroConta.deleteMany({});
      await tx.financeiroCategoria.deleteMany({});
      await tx.financeiroMeioPagamento.deleteMany({});

      await tx.usuario.deleteMany({
        where: { id: { not: protectedId } },
      });

      await tx.perfilAcesso.deleteMany({
        where: { id: { not: protectedPerfilId } },
      });

      await tx.usuario.update({
        where: { id: protectedId },
        data: {
          vinculacaoTipo: null,
          vinculacaoPessoaId: null,
          ativo: true,
        },
      });
    },
    { timeout: 600_000, maxWait: 60_000 }
  );

  const remaining = await prisma.usuario.count();
  const perfis = await prisma.perfilAcesso.count();
  console.log(`Concluído. Usuários restantes: ${remaining}. Perfis de acesso restantes: ${perfis}.`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
