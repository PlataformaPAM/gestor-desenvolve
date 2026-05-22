import { prisma } from "@/lib/prisma";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { getSessionUserId } from "@/lib/server/request-session";
import {
  composeCodigoContrato,
  getContratoCodigoPersonalizadoMap,
  setContratoCodigoPersonalizado,
} from "@/lib/contratos/codigo-personalizado";
import type { ContratoStatus } from "@prisma/client";
import { markContratoAlertsResolvedIfApplicable } from "@/lib/server/alerts-resolve";
import { contratosAccessGate } from "@/lib/server/contratos-access";

function formatContratoCode(year: number, seq: number): string {
  return `CTT-${year}-${String(seq).padStart(4, "0")}`;
}

async function resolveContratoCodeByCreatedAt(id: string, createdAt: Date): Promise<string> {
  const start = new Date(createdAt.getFullYear(), 0, 1, 0, 0, 0, 0);
  const end = new Date(createdAt.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
  const idsDoAno = await prisma.contrato.findMany({
    where: { createdAt: { gte: start, lt: end } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  const idx = idsDoAno.findIndex((x) => x.id === id);
  return formatContratoCode(createdAt.getFullYear(), idx >= 0 ? idx + 1 : 1);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapContratoDetalhe(c: any, codigo: string, codigoPersonalizado?: string | null) {
  const lead = c.lead ?? null;
  const aditivos = Array.isArray(c.aditivos)
    ? c.aditivos.map(
        (a: {
          id: string;
          tipo: string;
          titulo: string;
          descricao: string | null;
          valorAnterior: number | null;
          valorNovo: number | null;
          createdAt: Date;
        }) => ({
          id: a.id,
          tipo: a.tipo,
          titulo: a.titulo,
          descricao: a.descricao,
          valorAnterior: a.valorAnterior,
          valorNovo: a.valorNovo,
          createdAt: a.createdAt.toISOString(),
        })
      )
    : [];

  return {
    id: c.id,
    codigo: composeCodigoContrato(codigo, codigoPersonalizado),
    codigoSistema: codigo,
    codigoPersonalizado: codigoPersonalizado ?? null,
    leadId: c.leadId,
    clienteId: c.clienteId,
    origem: c.origem,
    geraPosVenda: c.geraPosVenda,
    titulo: c.titulo,
    status: c.status,
    valorTotal: c.valorTotal,
    dataInicio: c.dataInicio?.toISOString() ?? null,
    dataFim: c.dataFim?.toISOString() ?? null,
    observacoes: c.observacoes ?? null,
    condicoesGerais: c.condicoesGerais ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    registroCriadoPorNome: c.criadoPor?.nomeExibicao ?? null,
    registroAtualizadoPorNome: c.atualizadoPor?.nomeExibicao ?? null,
    cliente: {
      id: c.cliente.id,
      nome: c.cliente.nome,
      empresa: c.cliente.empresa,
      cpfCnpj: c.cliente.cpfCnpj,
    },
    lead: lead
      ? {
          id: lead.id,
          name: lead.name,
          stageId: lead.stageId,
          valorTotal: lead.valorTotal,
          value: lead.value,
          financeiroFluxo: lead.financeiroFluxo
            ? {
                status: lead.financeiroFluxo.status,
                bloqueadoEdicao: lead.financeiroFluxo.bloqueadoEdicao,
                solicitadoEm: lead.financeiroFluxo.solicitadoEm?.toISOString() ?? null,
                aprovadoEm: lead.financeiroFluxo.aprovadoEm?.toISOString() ?? null,
              }
            : null,
        }
      : null,
    itens: c.itens.map(
      (i: {
        id: string;
        nome: string;
        valor: number | null;
        condicoesPagamento: string | null;
        solucaoCatalogoId: string | null;
      }) => ({
        id: i.id,
        nome: i.nome,
        valor: i.valor,
        condicoesPagamento: i.condicoesPagamento,
        solucaoCatalogoId: i.solucaoCatalogoId,
      })
    ),
    aditivos,
  };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const gate = await contratosAccessGate(req, "ver", id);
  if (!gate.ok) return gate.response;

  try {
    let c = await prisma.contrato.findUnique({
      where: { id },
      include: {
        cliente: { select: { id: true, nome: true, empresa: true, cpfCnpj: true } },
        lead: {
          select: {
            id: true,
            name: true,
            stageId: true,
            valorTotal: true,
            value: true,
            financeiroFluxo: {
              select: { status: true, bloqueadoEdicao: true, solicitadoEm: true, aprovadoEm: true },
            },
          },
        },
        itens: { orderBy: { createdAt: "asc" } },
        aditivos: { orderBy: { createdAt: "desc" } },
        criadoPor: { select: { nomeExibicao: true } },
        atualizadoPor: { select: { nomeExibicao: true } },
      },
    });

    if (!c) return fail("NOT_FOUND", "Contrato não encontrado.", 404);
    if (c.status === "ativo" && c.dataFim) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const venc = new Date(c.dataFim);
      venc.setHours(0, 0, 0, 0);
      if (venc < hoje) {
        await prisma.contrato.update({ where: { id }, data: { status: "suspenso" } });
        c = await prisma.contrato.findUnique({
          where: { id },
          include: {
            cliente: { select: { id: true, nome: true, empresa: true, cpfCnpj: true } },
            lead: {
              select: {
                id: true,
                name: true,
                stageId: true,
                valorTotal: true,
                value: true,
                financeiroFluxo: {
                  select: { status: true, bloqueadoEdicao: true, solicitadoEm: true, aprovadoEm: true },
                },
              },
            },
            itens: { orderBy: { createdAt: "asc" } },
            aditivos: { orderBy: { createdAt: "desc" } },
            criadoPor: { select: { nomeExibicao: true } },
            atualizadoPor: { select: { nomeExibicao: true } },
          },
        });
        if (!c) return fail("NOT_FOUND", "Contrato não encontrado.", 404);
      }
    }

    const codigo = await resolveContratoCodeByCreatedAt(c.id, c.createdAt);
    const customMap = await getContratoCodigoPersonalizadoMap();
    const payload = mapContratoDetalhe(c, codigo, customMap[c.id] ?? null);
    return ok({ contrato: payload, data: { contrato: payload } });
  } catch {
    return fail("INTERNAL_ERROR", "Falha ao carregar contrato.", 500);
  }
}

type PatchBody = {
  titulo?: string;
  valorTotal?: number;
  status?: ContratoStatus;
  dataInicio?: string | null;
  dataFim?: string | null;
  observacoes?: string | null;
  condicoesGerais?: string | null;
  geraPosVenda?: boolean;
  codigoPersonalizado?: string | null;
  aditivo?: {
    tipo: string;
    titulo: string;
    descricao?: string;
    valorAnterior?: number | null;
    valorNovo?: number | null;
    condicoesAnteriores?: string | null;
    condicoesNovas?: string | null;
    dataInicioAnterior?: string | null;
    dataInicioNova?: string | null;
    dataFimAnterior?: string | null;
    dataFimNova?: string | null;
  };
};

function parseYmdOrThrow(v: string | null | undefined, allowNullish: boolean): Date | null | undefined {
  if (v === undefined && allowNullish) return undefined;
  if (v === null || v === "") return null;
  const d = new Date(`${v}T12:00:00`);
  if (Number.isNaN(d.getTime())) throw new Error("DATA_INVALIDA");
  return d;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const gate = await contratosAccessGate(req, "editar", id);
  if (!gate.ok) return gate.response;

  const sessionUserId = gate.userId ?? getSessionUserId(req);
  const parsed = await parseJsonSafe<PatchBody>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const b = parsed.value;

  const current = await prisma.contrato.findUnique({ where: { id } });
  if (!current) return fail("NOT_FOUND", "Contrato não encontrado.", 404);

  try {
    await prisma.$transaction(async (tx) => {
      if (b.aditivo?.titulo?.trim() && b.aditivo?.tipo?.trim()) {
        await tx.contratoAditivo.create({
          data: {
            contratoId: id,
            tipo: b.aditivo.tipo.trim(),
            titulo: b.aditivo.titulo.trim(),
            descricao: b.aditivo.descricao?.trim() || null,
            valorAnterior: b.aditivo.valorAnterior ?? null,
            valorNovo: b.aditivo.valorNovo ?? null,
            condicoesAnteriores: b.aditivo.condicoesAnteriores ?? null,
            condicoesNovas: b.aditivo.condicoesNovas ?? null,
            dataInicioAnterior: parseYmdOrThrow(b.aditivo.dataInicioAnterior, true) ?? null,
            dataInicioNova: parseYmdOrThrow(b.aditivo.dataInicioNova, true) ?? null,
            dataFimAnterior: parseYmdOrThrow(b.aditivo.dataFimAnterior, true) ?? null,
            dataFimNova: parseYmdOrThrow(b.aditivo.dataFimNova, true) ?? null,
            registradoPorId: sessionUserId ?? undefined,
          },
        });
      }

      let dataInicioUp: Date | null | undefined;
      let dataFimUp: Date | null | undefined;
      if (b.dataInicio !== undefined) {
        dataInicioUp =
          b.dataInicio === null ? null : parseYmdOrThrow(String(b.dataInicio), false);
      }
      if (b.dataFim !== undefined) {
        dataFimUp = b.dataFim === null ? null : parseYmdOrThrow(String(b.dataFim), false);
      }

      await tx.contrato.update({
        where: { id },
        data: {
          ...(b.titulo !== undefined ? { titulo: b.titulo.trim() || null } : {}),
          ...(typeof b.valorTotal === "number" && !Number.isNaN(b.valorTotal) ? { valorTotal: b.valorTotal } : {}),
          ...(b.status ? { status: b.status } : {}),
          ...(b.dataInicio !== undefined ? { dataInicio: dataInicioUp ?? null } : {}),
          ...(b.dataFim !== undefined ? { dataFim: dataFimUp ?? null } : {}),
          ...(b.observacoes !== undefined ? { observacoes: b.observacoes } : {}),
          ...(b.condicoesGerais !== undefined ? { condicoesGerais: b.condicoesGerais } : {}),
          ...(b.geraPosVenda !== undefined ? { geraPosVenda: b.geraPosVenda } : {}),
          ...(sessionUserId ? { atualizadoPorId: sessionUserId } : {}),
        },
      });
    });

    if (b.codigoPersonalizado !== undefined) {
      await setContratoCodigoPersonalizado(id, b.codigoPersonalizado);
    }
  } catch (e) {
    if (e instanceof Error && e.message === "DATA_INVALIDA") {
      return fail("BAD_REQUEST", "Data inválida. Use AAAA-MM-DD.", 400);
    }
    return fail("INTERNAL_ERROR", "Falha ao atualizar contrato.", 500);
  }

  const saved = await prisma.contrato.findUnique({
    where: { id },
    include: {
      cliente: { select: { id: true, nome: true, empresa: true, cpfCnpj: true } },
      lead: {
        select: {
          id: true,
          name: true,
          stageId: true,
          valorTotal: true,
          value: true,
          financeiroFluxo: {
            select: { status: true, bloqueadoEdicao: true, solicitadoEm: true, aprovadoEm: true },
          },
        },
      },
      itens: { orderBy: { createdAt: "asc" } },
      aditivos: { orderBy: { createdAt: "desc" } },
      criadoPor: { select: { nomeExibicao: true } },
      atualizadoPor: { select: { nomeExibicao: true } },
    },
  });

  if (!saved) return fail("INTERNAL_ERROR", "Falha ao recarregar.", 500);

  await writeAuditLog(prisma, {
    usuarioId: sessionUserId,
    acao: b.aditivo?.titulo ? "Aditivo de contrato registrado" : "Contrato atualizado",
    modulo: "contratos",
    detalhes: id,
  });

  await markContratoAlertsResolvedIfApplicable(prisma, {
    id: saved.id,
    leadId: saved.leadId,
    status: saved.status,
    dataFim: saved.dataFim,
  });

  const codigo = await resolveContratoCodeByCreatedAt(saved.id, saved.createdAt);
  const customMap = await getContratoCodigoPersonalizadoMap();
  const out = mapContratoDetalhe(saved, codigo, customMap[saved.id] ?? null);
  return ok({ contrato: out, data: { contrato: out } });
}
