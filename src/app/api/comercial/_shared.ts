import type {
  Cliente as PrismaCliente,
  Lead as PrismaLead,
  PrismaClient,
  SolucaoCatalogo,
} from "@prisma/client";
import type { Cliente, Contato } from "@/lib/clientes/types";
import type { Lead, LeadRecorrenciaPagamento } from "@/lib/comercial/types";
import { mapSolucao } from "@/app/api/solucoes/_shared";

export function toDateOrUndefined(v: string | null | undefined): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Evita string vazia em FK `userId` (Prisma/Postgres rejeitam ou quebram o vínculo). */
export function resolveLeadInteractionUserId(
  interaction: { userId?: string | null },
  sessionUserId: string | null | undefined
): string | null {
  const fromPayload = typeof interaction.userId === "string" ? interaction.userId.trim() : "";
  if (fromPayload) return fromPayload;
  const fromSession = typeof sessionUserId === "string" ? sessionUserId.trim() : "";
  return fromSession || null;
}

/** Só retorna id se existir em `Usuario` (evita FK ao criar/editar lead com sessão órfã ou payload legado). */
export async function resolveUsuarioIdForPrismaFk(
  prisma: Pick<PrismaClient, "usuario">,
  candidate: string | null | undefined
): Promise<string | undefined> {
  const t = typeof candidate === "string" ? candidate.trim() : "";
  if (!t) return undefined;
  const row = await prisma.usuario.findUnique({ where: { id: t }, select: { id: true } });
  return row?.id;
}

/**
 * Garante que o enum Postgres `LeadPriority` inclua `urgente`.
 * Evita P2007 quando o código/Prisma já esperam `urgente`, mas o banco ficou sem a migração correspondente.
 */
export async function ensureLeadPriorityEnumIncludesUrgente(
  db: Pick<PrismaClient, "$executeRawUnsafe">
): Promise<void> {
  try {
    await db.$executeRawUnsafe(`
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_enum e
    INNER JOIN pg_catalog.pg_type t ON e.enumtypid = t.oid
    INNER JOIN pg_catalog.pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = current_schema()
      AND t.typname = 'LeadPriority'
      AND e.enumlabel = 'urgente'
  ) THEN
    ALTER TYPE "LeadPriority" ADD VALUE 'urgente';
  END IF;
END
$enum$;
`);
  } catch (err) {
    console.warn("[comercial] ensureLeadPriorityEnumIncludesUrgente:", err);
  }
}

export async function filterUsuarioIdsExisting(
  prisma: Pick<PrismaClient, "usuario">,
  ids: string[]
): Promise<Set<string>> {
  const unique = [...new Set(ids.map((x) => x.trim()).filter(Boolean))];
  if (!unique.length) return new Set();
  const rows = await prisma.usuario.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

export function mapClienteFromDb(
  c: PrismaCliente & {
    criadoPor?: { nomeExibicao: string | null } | null;
    endereco: {
      logradouro: string;
      numero: string;
      complemento: string | null;
      bairro: string;
      cidade: string;
      uf: string;
      cep: string;
    } | null;
    contatos: Array<{
      id: string;
      nome: string;
      email: string;
      telefone: string;
      setor: string | null;
      cargo: string | null;
      papeis: Array<{ papel: string }>;
    }>;
    propostas: Array<{ id: string; titulo: string; valor: number; dataProposta: Date; status: string }>;
    faturas: Array<{ id: string; vencimento: Date; valor: number; status: string }>;
    ticketsResumo: Array<{ id: string; assunto: string; dataAbertura: Date; status: string }>;
  }
): Cliente {
  return {
    id: c.id,
    nome: c.nome,
    empresa: c.empresa,
    cpfCnpj: c.cpfCnpj,
    status: c.status as Cliente["status"],
    valorMensal: c.valorMensal,
    segmento: c.segmento as Cliente["segmento"],
    email: c.email ?? undefined,
    telefone: c.telefone ?? undefined,
    urlSiteOficial: c.urlSiteOficial ?? undefined,
    dataFechamento: c.dataFechamento?.toISOString(),
    endereco: c.endereco
      ? {
          logradouro: c.endereco.logradouro,
          numero: c.endereco.numero,
          complemento: c.endereco.complemento ?? undefined,
          bairro: c.endereco.bairro,
          cidade: c.endereco.cidade,
          uf: c.endereco.uf,
          cep: c.endereco.cep,
        }
      : undefined,
    contatos: c.contatos.map((ct) => ({
      id: ct.id,
      nome: ct.nome,
      email: ct.email,
      telefone: ct.telefone,
      setor: ct.setor ?? undefined,
      cargo: ct.cargo ?? undefined,
      papeis: ct.papeis.map((p) => p.papel as NonNullable<Contato["papeis"]>[number]),
    })),
    propostas: c.propostas.map((p) => ({
      id: p.id,
      titulo: p.titulo,
      valor: p.valor,
      dataProposta: p.dataProposta.toISOString(),
      status: p.status as NonNullable<Cliente["propostas"]>[number]["status"],
    })),
    faturas: c.faturas.map((f) => ({
      id: f.id,
      vencimento: f.vencimento.toISOString(),
      valor: f.valor,
      status: f.status as NonNullable<Cliente["faturas"]>[number]["status"],
    })),
    faturasPagas: c.faturas.filter((f) => f.status === "paga").length,
    faturasPendentes: c.faturas.filter((f) => f.status !== "paga").length,
    tickets: c.ticketsResumo.map((t) => ({
      id: t.id,
      assunto: t.assunto,
      dataAbertura: t.dataAbertura.toISOString(),
      status: t.status as NonNullable<Cliente["tickets"]>[number]["status"],
    })),
    registroCriadoPorNome: c.criadoPor?.nomeExibicao?.trim() || null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function mapLeadFromDb(
  lead: PrismaLead & {
    criadoPor?: { nomeExibicao: string | null } | null;
    atualizadoPor?: { nomeExibicao: string | null } | null;
    solucoes: Array<{
      id: string;
      nome: string;
      valor: number | null;
      condicoesPagamento: string | null;
      solucaoCatalogoId: string | null;
      recorrenciaPagamento: string | null;
      parcelas: number | null;
      solucaoCatalogo: SolucaoCatalogo | null;
    }>;
    contatos: Array<{
      id: string;
      nome: string;
      cargo: string | null;
      setor: string | null;
      telefone: string;
      email: string;
      papeis: Array<{ papel: string }>;
    }>;
    checklistItems: Array<{ taskKey: string; done: boolean }>;
    contratoChecklist: {
      aprovacaoCliente: boolean;
      recebimentoDocumentacao: boolean;
      envioDocumentacao: boolean;
      ordemCompra: boolean;
    } | null;
    contratoArquivos: Array<{ tipo: string; nomeArquivo: string; createdAt: Date }>;
    interactions: Array<{
      id: string;
      date: Date;
      type: string;
      description: string;
      action: string | null;
      field: string | null;
      fieldKey: string | null;
      oldValue: unknown;
      newValue: unknown;
      userId: string | null;
      autorNome: string | null;
      user: { nomeExibicao: string | null } | null;
      anexos: Array<{ nome: string; url: string | null }>;
    }>;
    financeiroFluxo: {
      status: string;
      bloqueadoEdicao: boolean;
      solicitadoEm: Date | null;
      aprovadoEm: Date | null;
      devolvidoEm: Date | null;
      motivoDevolucao: string | null;
      liberacaoSolicitadaEm: Date | null;
      motivoSolicitacaoLiberacao: string | null;
    } | null;
  }
): Lead {
  const checklistProgress = lead.checklistItems.reduce<Record<string, boolean>>((acc, item) => {
    acc[item.taskKey] = item.done;
    return acc;
  }, {});
  const minuta = lead.contratoArquivos.filter((x) => x.tipo === "minuta").map((x) => x.nomeArquivo);
  const assinatura = lead.contratoArquivos.filter((x) => x.tipo === "assinatura").map((x) => x.nomeArquivo);
  const contratoAnexosCliente = [...lead.contratoArquivos]
    .map((x) => ({
      nome: x.nomeArquivo,
      anexadoEm: x.createdAt.toISOString(),
    }))
    .sort((a, b) => new Date(b.anexadoEm).getTime() - new Date(a.anexadoEm).getTime());
  return {
    id: lead.id,
    name: lead.name,
    value: lead.value,
    valorTotal: lead.valorTotal,
    stageId: lead.stageId as Lead["stageId"],
    priority: lead.priority as Lead["priority"],
    enteredStageAt: lead.enteredStageAt.toISOString(),
    origem: lead.origem as Lead["origem"],
    registroLead: lead.registroLead as Lead["registroLead"],
    clienteId: lead.clienteId,
    solucoes: lead.solucoes.map((s) => {
      const mappedCatalog = s.solucaoCatalogo ? mapSolucao(s.solucaoCatalogo) : null;
      const logoRaw = mappedCatalog?.logoUrl?.trim();
      const rec = s.recorrenciaPagamento as LeadRecorrenciaPagamento | null;
      return {
        id: s.id,
        solucaoCatalogoId: s.solucaoCatalogoId,
        nome: s.nome,
        valor: s.valor ?? undefined,
        condicoesPagamento: s.condicoesPagamento ?? undefined,
        ...(rec === "mensal" || rec === "unica" || rec === "parcelado"
          ? { recorrenciaPagamento: rec }
          : {}),
        ...(s.parcelas != null ? { parcelas: s.parcelas } : {}),
        ...(logoRaw ? { logoUrl: logoRaw } : {}),
      };
    }),
    contatosOportunidade: lead.contatos.map((c) => ({
      id: c.id,
      nome: c.nome,
      cargo: c.cargo ?? undefined,
      setor: c.setor ?? undefined,
      telefone: c.telefone,
      email: c.email,
      papeis: c.papeis.map(
        (p) => p.papel as NonNullable<NonNullable<Lead["contatosOportunidade"]>[number]["papeis"]>[number]
      ),
    })),
    checklistProgress,
    contratoChecklist: lead.contratoChecklist ?? undefined,
    contratoArquivos: { minuta, assinatura },
    contratoAnexosCliente,
    propostaGeradaEm: lead.propostaGeradaEm?.toISOString(),
    previsaoFechamento: lead.previsaoFechamento
      ? lead.previsaoFechamento.toISOString().slice(0, 10)
      : undefined,
    cpf: lead.cpf ?? undefined,
    company: lead.company ?? undefined,
    contact: lead.contact ?? undefined,
    email: lead.email ?? undefined,
    phone: lead.phone ?? undefined,
    municipioUf: lead.municipioUf ?? undefined,
    entidade: lead.entidade ?? undefined,
    cargo: lead.cargo ?? undefined,
    notes: lead.notes ?? undefined,
    financeiroFluxo: lead.financeiroFluxo
      ? {
          status: lead.financeiroFluxo.status as NonNullable<Lead["financeiroFluxo"]>["status"],
          bloqueadoEdicao: lead.financeiroFluxo.bloqueadoEdicao,
          solicitadoEm: lead.financeiroFluxo.solicitadoEm?.toISOString(),
          aprovadoEm: lead.financeiroFluxo.aprovadoEm?.toISOString(),
          devolvidoEm: lead.financeiroFluxo.devolvidoEm?.toISOString(),
          motivoDevolucao: lead.financeiroFluxo.motivoDevolucao ?? undefined,
          liberacaoSolicitadaEm: lead.financeiroFluxo.liberacaoSolicitadaEm?.toISOString(),
          motivoSolicitacaoLiberacao: lead.financeiroFluxo.motivoSolicitacaoLiberacao ?? undefined,
        }
      : undefined,
    interactions: lead.interactions.map((i) => ({
      id: i.id,
      date: i.date.toISOString(),
      type: i.type as NonNullable<Lead["interactions"]>[number]["type"],
      description: i.description,
      userId: i.userId ?? null,
      user:
        i.user?.nomeExibicao?.trim() ||
        i.autorNome?.trim() ||
        undefined,
      action: (i.action ?? undefined) as NonNullable<Lead["interactions"]>[number]["action"],
      field: i.field ?? undefined,
      fieldKey: i.fieldKey ?? undefined,
      oldValue: i.oldValue as unknown,
      newValue: i.newValue as unknown,
      anexos: i.anexos.map((a) => ({ name: a.nome, url: a.url ?? "" })),
    })),
    criadoPorId: lead.criadoPorId ?? null,
    registroCriadoPorNome: lead.criadoPor?.nomeExibicao ?? null,
    registroAtualizadoPorNome: lead.atualizadoPor?.nomeExibicao ?? null,
    registroCriadoEm: lead.createdAt.toISOString(),
    registroAtualizadoEm: lead.updatedAt.toISOString(),
  };
}

