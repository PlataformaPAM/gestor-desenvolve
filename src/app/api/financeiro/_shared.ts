import type { Cliente, Lancamento } from "@prisma/client";
import type { Cliente as ClienteFront } from "@/lib/clientes/types";
import type { Lancamento as LancamentoFront } from "@/lib/financeiro/types";

export type AprovacaoLinha = {
  leadSolucaoId: string;
  nome: string;
  valor: number;
  condicoesPagamento?: string;
  recorrenciaPagamento: "mensal" | "unica" | "parcelado" | null;
  parcelas: number | null;
};

export type AprovacaoPendente = {
  leadId: string;
  leadNome: string;
  clienteId: string;
  clienteNome: string;
  valorTotal: number;
  solucoes: AprovacaoLinha[];
  solicitadoEm: string;
  responsavelNome?: string;
};

export type UnlockRequest = {
  id: string;
  leadId: string;
  leadNome: string;
  solicitadoEm: string;
  motivo: string;
};

export function mapLancamentoFromDb(
  l: Lancamento & { criadoPor?: { nomeExibicao: string | null } | null }
): LancamentoFront {
  return {
    id: l.id,
    tipo: l.tipo as LancamentoFront["tipo"],
    descricao: l.descricao,
    clienteId: l.clienteId ?? undefined,
    fornecedor: l.fornecedor ?? undefined,
    vencimento: l.vencimento.toISOString().slice(0, 10),
    valor: l.valor,
    status: l.status as LancamentoFront["status"],
    dataPagamento: l.dataPagamento?.toISOString(),
    tipoRecorrencia: (l.tipoRecorrencia as LancamentoFront["tipoRecorrencia"]) ?? undefined,
    parcelas: l.parcelas ?? undefined,
    idPai: l.idPai ?? undefined,
    parcelaNumero: l.parcelaNumero ?? undefined,
    leadIdOrigem: l.leadIdOrigem ?? undefined,
    leadSolucaoId: l.leadSolucaoId ?? undefined,
    formaPagamento: l.formaPagamento ?? undefined,
    condicoesPagamento: l.condicoesPagamento ?? undefined,
    prazoDias: l.prazoDias ?? undefined,
    contaId: l.contaId ?? undefined,
    categoriaId: l.categoriaId ?? undefined,
    meioPagamentoId: l.meioPagamentoId ?? undefined,
    registroCriadoPorNome: l.criadoPor?.nomeExibicao?.trim() ?? null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

export function mapClienteSlimFromDb(c: Cliente): ClienteFront {
  return {
    id: c.id,
    nome: c.nome,
    empresa: c.empresa,
    cpfCnpj: c.cpfCnpj,
    status: c.status as ClienteFront["status"],
    valorMensal: c.valorMensal,
    segmento: c.segmento as ClienteFront["segmento"],
    contatos: [],
    propostas: [],
    faturas: [],
    faturasPagas: 0,
    faturasPendentes: 0,
    tickets: [],
    email: c.email ?? undefined,
    telefone: c.telefone ?? undefined,
    urlSiteOficial: c.urlSiteOficial ?? undefined,
    dataFechamento: c.dataFechamento?.toISOString(),
  };
}

