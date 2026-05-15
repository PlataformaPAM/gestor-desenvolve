import type { Prisma, PrismaClient, TipoPessoaRH } from "@prisma/client";
import { RH_CONSULTOR_PRE_CADASTRO_CARGO, normalizeNomeRh } from "@/lib/rh/pre-cadastro-consultor";

export type MembroVenda = { id: string; nome: string };

export type ConsultorRhComissao = {
  id: string;
  nome: string;
};

const TIPOS_COMISSAO: TipoPessoaRH[] = ["equipe_interna", "vendedor_externo"];

/** Filtro de ColaboradorRH elegível para comissão (reutilizável em APIs). */
export function colaboradorRhWhereParaComissao(): Prisma.ColaboradorRHWhereInput {
  return {
    status: "ativo",
    cadastroEfetivado: true,
    tipoPessoa: { in: TIPOS_COMISSAO },
    NOT: {
      tipoPessoa: "vendedor_externo" as const,
      cargoOuFuncao: RH_CONSULTOR_PRE_CADASTRO_CARGO,
    },
  };
}

export function parseOwnershipSnapshot(raw: unknown): {
  principal: MembroVenda | null;
  colaboradores: MembroVenda[];
} {
  if (!raw || typeof raw !== "object") {
    return { principal: null, colaboradores: [] };
  }
  const data = raw as Record<string, unknown>;
  const responsavelId = typeof data.responsavelId === "string" ? data.responsavelId.trim() : "";
  const responsavelNome = typeof data.responsavelNome === "string" ? data.responsavelNome.trim() : "";
  const principal: MembroVenda | null =
    responsavelId && responsavelNome ? { id: responsavelId, nome: responsavelNome } : null;

  const colaboradores = Array.isArray(data.colaboradores)
    ? data.colaboradores
        .map((c) => {
          if (!c || typeof c !== "object") return null;
          const itemObj = c as Record<string, unknown>;
          const id = typeof itemObj.id === "string" ? itemObj.id.trim() : "";
          const nome = typeof itemObj.nome === "string" ? itemObj.nome.trim() : "";
          if (!id || !nome) return null;
          return { id, nome } as MembroVenda;
        })
        .filter((x): x is MembroVenda => !!x)
    : [];

  return { principal, colaboradores };
}

/** Ordem: responsável principal primeiro, depois colaboradores; dedup por `id`. */
export function mergeEquipeVenda(principal: MembroVenda | null, colaboradores: MembroVenda[]): MembroVenda[] {
  const seen = new Set<string>();
  const out: MembroVenda[] = [];
  const push = (m: MembroVenda) => {
    if (seen.has(m.id)) return;
    seen.add(m.id);
    out.push(m);
  };
  if (principal) push(principal);
  for (const c of colaboradores) push(c);
  return out;
}

export async function loadMembrosVendaDoLead(
  prisma: Pick<PrismaClient, "leadInteraction">,
  leadId: string
): Promise<MembroVenda[]> {
  const ownershipLog = await prisma.leadInteraction.findFirst({
    where: { leadId, type: "sistema", fieldKey: "ownership" },
    orderBy: { date: "desc" },
    select: { newValue: true },
  });
  const { principal, colaboradores } = parseOwnershipSnapshot(ownershipLog?.newValue);
  return mergeEquipeVenda(principal, colaboradores);
}

async function findColaboradorElegivel(
  tx: Prisma.TransactionClient,
  colaboradorId: string
): Promise<ConsultorRhComissao | null> {
  const row = await tx.colaboradorRH.findFirst({
    where: { id: colaboradorId, ...colaboradorRhWhereParaComissao() },
    select: { id: true, nome: true },
  });
  return row ? { id: row.id, nome: row.nome } : null;
}

async function resolvePorNome(
  tx: Prisma.TransactionClient,
  nome: string
): Promise<ConsultorRhComissao | null> {
  const key = normalizeNomeRh(nome);
  if (!key) return null;
  const rows = await tx.colaboradorRH.findMany({
    where: {
      ...colaboradorRhWhereParaComissao(),
    },
    select: { id: true, nome: true },
  });
  const matches = rows.filter((r: { id: string; nome: string }) => normalizeNomeRh(r.nome) === key);
  if (matches.length !== 1) return null;
  return { id: matches[0].id, nome: matches[0].nome };
}

/**
 * Mapeia membro da equipe comercial (id de usuário ou, em raros casos, id de ColaboradorRH)
 * para o cadastro em RH elegível a comissão.
 */
export async function resolveMembroParaConsultorRh(
  tx: Prisma.TransactionClient,
  membro: MembroVenda
): Promise<ConsultorRhComissao | null> {
  const direto = await findColaboradorElegivel(tx, membro.id);
  if (direto) return direto;

  const usuario = await tx.usuario.findUnique({
    where: { id: membro.id },
    select: {
      id: true,
      ativo: true,
      nomeExibicao: true,
      vinculacaoTipo: true,
      vinculacaoPessoaId: true,
    },
  });
  if (usuario?.ativo && usuario.vinculacaoTipo === "rh" && usuario.vinculacaoPessoaId) {
    const viaVinculo = await findColaboradorElegivel(tx, usuario.vinculacaoPessoaId);
    if (viaVinculo) return viaVinculo;
  }

  const nomeParaMatch = (usuario?.nomeExibicao?.trim() || membro.nome).trim();
  return resolvePorNome(tx, nomeParaMatch);
}

export type EquipeResolvidaItem = {
  membro: MembroVenda;
  consultor: ConsultorRhComissao | null;
};

export async function resolveEquipeVendaParaComissao(
  tx: Prisma.TransactionClient,
  leadId: string
): Promise<EquipeResolvidaItem[]> {
  const membros = await loadMembrosVendaDoLead(tx, leadId);
  const out: EquipeResolvidaItem[] = [];
  for (const m of membros) {
    out.push({ membro: m, consultor: await resolveMembroParaConsultorRh(tx, m) });
  }
  return out;
}

export function consultoresUnicosResolvidos(equipe: EquipeResolvidaItem[]): ConsultorRhComissao[] {
  const byId = new Map<string, ConsultorRhComissao>();
  for (const it of equipe) {
    if (it.consultor) byId.set(it.consultor.id, it.consultor);
  }
  return [...byId.values()];
}

const SUM_EPS = 0.02;

export async function somaPercentuaisParticipacao(
  tx: Prisma.TransactionClient,
  leadId: string,
  leadSolucaoId: string | null
): Promise<number> {
  const agg = await tx.comissaoParticipacaoVenda.aggregate({
    where: { leadId, leadSolucaoId, ativo: true },
    _sum: { percentualParticipacao: true },
  });
  return Number(agg._sum.percentualParticipacao?.toString() ?? "0");
}

/**
 * Regras de validação para aprovação financeira / gravação de percentuais.
 * - Mais de um consultor RH distinto na equipe: precisa haver linhas ativas no escopo e soma ≈ 100%.
 * - Um consultor: se houver linhas, soma ≈ 100%; se não houver linhas, ok (o motor usa 100% implícito).
 */
export async function validarParticipacoesNoEscopo(
  tx: Prisma.TransactionClient,
  params: { leadId: string; leadSolucaoId: string | null; consultorIdsExigidos: string[] }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { leadId, leadSolucaoId, consultorIdsExigidos } = params;
  const soma = await somaPercentuaisParticipacao(tx, leadId, leadSolucaoId);
  const rows = await tx.comissaoParticipacaoVenda.findMany({
    where: { leadId, leadSolucaoId, ativo: true },
    select: { consultorId: true },
  });
  const idsComLinha = new Set(rows.map((r) => r.consultorId));
  const n = consultorIdsExigidos.length;

  if (n > 1) {
    if (rows.length === 0) {
      return {
        ok: false,
        message:
          "Há mais de uma pessoa na equipe da venda. Defina no Financeiro os percentuais de comissão (soma 100%) para esta proposta/solução antes de concluir a aprovação.",
      };
    }
    for (const cid of consultorIdsExigidos) {
      if (!idsComLinha.has(cid)) {
        return {
          ok: false,
          message:
            "Defina percentual de participação para cada consultor da equipe (responsável e colaboradores) neste escopo, totalizando 100%.",
        };
      }
    }
    if (Math.abs(soma - 100) > SUM_EPS) {
      return {
        ok: false,
        message: `Os percentuais de comissão deste escopo somam ${soma.toFixed(2)}% e devem totalizar 100%. Ajuste antes de concluir a aprovação.`,
      };
    }
    return { ok: true };
  }

  if (rows.length > 0 && Math.abs(soma - 100) > SUM_EPS) {
    return {
      ok: false,
      message: `Os percentuais de comissão deste escopo somam ${soma.toFixed(2)}% e devem totalizar 100%.`,
    };
  }
  return { ok: true };
}
