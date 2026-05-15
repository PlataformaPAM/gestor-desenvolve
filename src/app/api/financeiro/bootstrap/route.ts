import { prisma } from "@/lib/prisma";
import {
  mapClienteSlimFromDb,
  mapLancamentoFromDb,
  type AprovacaoLinha,
  type AprovacaoPendente,
  type UnlockRequest,
} from "../_shared";
import { fail, ok } from "@/lib/server/api-response";
import { ensureFinanceiroCadastros } from "../seed-defaults";
import type { FinanceiroCategoria, FinanceiroConta, FinanceiroMeioPagamento } from "@/lib/financeiro/types";
import { colaboradorRhWhereParaComissao } from "@/lib/server/comissoes-ownership-resolve";

async function querySafe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch {
    return fallback;
  }
}

function mapConta(c: {
  id: string;
  nome: string;
  saldoInicial: number;
  padrao: boolean;
  ativo: boolean;
  ordem: number;
}): FinanceiroConta {
  return {
    id: c.id,
    nome: c.nome,
    saldoInicial: c.saldoInicial,
    padrao: c.padrao,
    ativo: c.ativo,
    ordem: c.ordem,
  };
}

function mapCategoria(c: {
  id: string;
  nome: string;
  tipo: string;
  ativo: boolean;
  ordem: number;
}): FinanceiroCategoria {
  return {
    id: c.id,
    nome: c.nome,
    tipo: c.tipo as FinanceiroCategoria["tipo"],
    ativo: c.ativo,
    ordem: c.ordem,
  };
}

function mapMeio(m: { id: string; nome: string; ativo: boolean; ordem: number }): FinanceiroMeioPagamento {
  return { id: m.id, nome: m.nome, ativo: m.ativo, ordem: m.ordem };
}

export async function GET() {
  try {
    await ensureFinanceiroCadastros().catch(() => undefined);

    const [lancamentos, clientes, fornecedoresRh, leadsPendentes, leadsUnlock, contas, categorias, meios, consultoresComissaoRh] =
      await Promise.all([
      querySafe(
        () =>
          prisma.lancamento.findMany({
            orderBy: { vencimento: "asc" },
            include: { criadoPor: { select: { nomeExibicao: true } } },
          }),
        []
      ),
      querySafe(() => prisma.cliente.findMany({ orderBy: { nome: "asc" } }), []),
      querySafe(() => prisma.colaboradorRH.findMany({
        where: { tipoPessoa: "fornecedor_parceiro", status: "ativo" },
        select: { id: true, nome: true, cpfCnpj: true },
        orderBy: { nome: "asc" },
      }), []),
      querySafe(() => prisma.lead.findMany({
        where: {
          stageId: "fechado",
          registroLead: "oportunidade",
          clienteId: { not: null },
          financeiroFluxo: { is: { status: "pendente_aprovacao" } },
        },
        include: {
          cliente: true,
          financeiroFluxo: true,
          solucoes: true,
          criadoPor: { select: { nomeExibicao: true } },
          atualizadoPor: { select: { nomeExibicao: true } },
        },
        orderBy: { updatedAt: "desc" },
      }), []),
      querySafe(() => prisma.lead.findMany({
        where: {
          registroLead: "oportunidade",
          financeiroFluxo: {
            is: {
              bloqueadoEdicao: true,
              liberacaoSolicitadaEm: { not: null },
            },
          },
        },
        include: { financeiroFluxo: true },
        orderBy: { updatedAt: "desc" },
      }), []),
      querySafe(() => prisma.financeiroConta.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] }), []),
      querySafe(() => prisma.financeiroCategoria.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] }), []),
      querySafe(() => prisma.financeiroMeioPagamento.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] }), []),
      querySafe(() =>
        prisma.colaboradorRH.findMany({
          where: colaboradorRhWhereParaComissao(),
          select: { id: true, nome: true },
          orderBy: { nome: "asc" },
        })
      , []),
    ]);

  const aprovacoesPendentes: AprovacaoPendente[] = leadsPendentes
    .filter((l) => l.clienteId && l.cliente && l.financeiroFluxo?.solicitadoEm)
    .map((l) => ({
      leadId: l.id,
      leadNome: l.name,
      clienteId: l.clienteId as string,
      clienteNome: l.cliente?.empresa || l.cliente?.nome || "Cliente",
      valorTotal: l.valorTotal > 0 ? l.valorTotal : l.value,
      solucoes: (l.solucoes ?? []).map((s) => ({
        leadSolucaoId: s.id,
        nome: s.nome,
        valor: s.valor ?? 0,
        condicoesPagamento: s.condicoesPagamento ?? undefined,
        recorrenciaPagamento: (s.recorrenciaPagamento as AprovacaoLinha["recorrenciaPagamento"]) ?? null,
        parcelas: s.parcelas ?? null,
      })),
      solicitadoEm: (l.financeiroFluxo?.solicitadoEm ?? new Date()).toISOString(),
      responsavelNome: l.atualizadoPor?.nomeExibicao?.trim() || l.criadoPor?.nomeExibicao?.trim() || "—",
    }));

  const unlockRequests: UnlockRequest[] = leadsUnlock
    .filter((l) => l.financeiroFluxo?.liberacaoSolicitadaEm)
    .map((l) => ({
      id: `unlock-${l.id}`,
      leadId: l.id,
      leadNome: l.name,
      solicitadoEm: (l.financeiroFluxo?.liberacaoSolicitadaEm ?? new Date()).toISOString(),
      motivo: l.financeiroFluxo?.motivoSolicitacaoLiberacao || "Sem motivo informado.",
    }));

    const mappedLancamentos = lancamentos.map(mapLancamentoFromDb);
    const mappedClientes = clientes.map(mapClienteSlimFromDb);
    const mappedFornecedoresRh = fornecedoresRh.map((f) => ({
      id: f.id,
      nome: f.nome,
      cpfCnpj: f.cpfCnpj ?? undefined,
    }));
    const mappedContas = contas.map(mapConta);
    const mappedCategorias = categorias.map(mapCategoria);
    const mappedMeios = meios.map(mapMeio);
    const mappedConsultoresComissao = consultoresComissaoRh.map((c) => ({ id: c.id, nome: c.nome }));
    return ok({
      lancamentos: mappedLancamentos,
      clientes: mappedClientes,
      fornecedoresRh: mappedFornecedoresRh,
      contas: mappedContas,
      categorias: mappedCategorias,
      meiosPagamento: mappedMeios,
      consultoresComissaoRh: mappedConsultoresComissao,
      aprovacoesPendentes,
      unlockRequests,
      data: {
        lancamentos: mappedLancamentos,
        clientes: mappedClientes,
        fornecedoresRh: mappedFornecedoresRh,
        contas: mappedContas,
        categorias: mappedCategorias,
        meiosPagamento: mappedMeios,
        consultoresComissaoRh: mappedConsultoresComissao,
        aprovacoesPendentes,
        unlockRequests,
      },
    });
  } catch {
    return fail("INTERNAL_ERROR", "Falha ao carregar bootstrap financeiro.", 500);
  }
}

