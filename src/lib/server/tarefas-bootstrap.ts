import { prisma } from "@/lib/prisma";

/** Mesmo marcador usado em pós-venda (`src/app/api/pos-venda/_shared.ts`). */
const TAREFA_POSVENDA_MARKER = "[POSVENDA_META]";

function isTarefaInterna(row: { descricao?: string | null }): boolean {
  return !String(row.descricao ?? "").includes(TAREFA_POSVENDA_MARKER);
}

function filterTarefasInternas<T extends { descricao?: string | null }>(rows: T[]): T[] {
  return rows.filter(isTarefaInterna);
}

export const TAREFA_BOOTSTRAP_INCLUDE = {
  criadoPor: true,
  cliente: { select: { id: true, nome: true, empresa: true } },
  clientesVinculados: { include: { cliente: { select: { id: true, nome: true, empresa: true } } } },
  solucoesVinculadas: { include: { solucaoCatalogo: { select: { id: true, nome: true } } } },
  responsavel: true,
  colaboradores: { include: { usuario: true } },
  anexos: true,
  historico: { include: { autor: true, anexos: true }, orderBy: { data: "asc" as const } },
} as const;

export const TAREFA_BOOTSTRAP_INCLUDE_LEGACY = {
  cliente: { select: { id: true, nome: true, empresa: true } },
  responsavel: true,
  colaboradores: { include: { usuario: true } },
  anexos: true,
  historico: { include: { autor: true, anexos: true }, orderBy: { data: "asc" as const } },
} as const;

type SqlTarefaRow = {
  id: string;
  codigo: string | null;
  titulo: string;
  descricao: string | null;
  status: string;
  prioridade: string;
  dataInicio: Date;
  dataFim: Date;
  clienteId: string | null;
  solucaoId: string | null;
  responsavelId: string;
  responsavelNome: string | null;
  responsavelEmail: string;
  clienteNome: string | null;
  clienteEmpresa: string | null;
  createdAt: Date;
  updatedAt: Date;
};

async function attachRelationsToSqlRows(rows: SqlTarefaRow[]) {
  const ids = rows.map((r) => r.id);
  if (!ids.length) return [];

  const [anexos, historico, colaboradores, clientesVinculados, solucoesVinculadas] =
    await Promise.all([
      prisma.tarefaAnexo.findMany({ where: { tarefaId: { in: ids } } }).catch(() => []),
      prisma.tarefaHistorico
        .findMany({
          where: { tarefaId: { in: ids } },
          include: { autor: true, anexos: true },
          orderBy: { data: "asc" },
        })
        .catch(() => []),
      prisma.tarefaColaborador
        .findMany({ where: { tarefaId: { in: ids } }, include: { usuario: true } })
        .catch(() => []),
      prisma.tarefaCliente
        .findMany({
          where: { tarefaId: { in: ids } },
          include: { cliente: { select: { id: true, nome: true, empresa: true } } },
        })
        .catch(() => []),
      prisma.tarefaSolucao
        .findMany({
          where: { tarefaId: { in: ids } },
          include: { solucaoCatalogo: { select: { id: true, nome: true } } },
        })
        .catch(() => []),
    ]);

  const anexosByTarefa = new Map<string, typeof anexos>();
  for (const a of anexos) {
    const list = anexosByTarefa.get(a.tarefaId) ?? [];
    list.push(a);
    anexosByTarefa.set(a.tarefaId, list);
  }
  const historicoByTarefa = new Map<string, typeof historico>();
  for (const h of historico) {
    const list = historicoByTarefa.get(h.tarefaId) ?? [];
    list.push(h);
    historicoByTarefa.set(h.tarefaId, list);
  }
  const colabByTarefa = new Map<string, typeof colaboradores>();
  for (const c of colaboradores) {
    const list = colabByTarefa.get(c.tarefaId) ?? [];
    list.push(c);
    colabByTarefa.set(c.tarefaId, list);
  }
  const clientesByTarefa = new Map<string, typeof clientesVinculados>();
  for (const cv of clientesVinculados) {
    const list = clientesByTarefa.get(cv.tarefaId) ?? [];
    list.push(cv);
    clientesByTarefa.set(cv.tarefaId, list);
  }
  const solucoesByTarefa = new Map<string, typeof solucoesVinculadas>();
  for (const sv of solucoesVinculadas) {
    const list = solucoesByTarefa.get(sv.tarefaId) ?? [];
    list.push(sv);
    solucoesByTarefa.set(sv.tarefaId, list);
  }

  return rows.map((r) => ({
    id: r.id,
    codigo: r.codigo ?? "",
    titulo: r.titulo,
    descricao: r.descricao,
    status: r.status,
    prioridade: r.prioridade,
    dataInicio: r.dataInicio,
    dataFim: r.dataFim,
    clienteId: r.clienteId,
    solucaoId: r.solucaoId,
    responsavelId: r.responsavelId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    responsavel: {
      id: r.responsavelId,
      nomeExibicao: r.responsavelNome,
      email: r.responsavelEmail,
    },
    colaboradores: colabByTarefa.get(r.id) ?? [],
    anexos: anexosByTarefa.get(r.id) ?? [],
    historico: historicoByTarefa.get(r.id) ?? [],
    cliente: r.clienteId
      ? { id: r.clienteId, nome: r.clienteNome ?? "", empresa: r.clienteEmpresa }
      : null,
    clientesVinculados: clientesByTarefa.get(r.id) ?? [],
    solucoesVinculadas: solucoesByTarefa.get(r.id) ?? [],
  }));
}

async function loadTarefasSql(withCodigo: boolean) {
  const selectCodigo = withCodigo ? `t."codigo",` : "";
  const rows = await prisma.$queryRawUnsafe<SqlTarefaRow[]>(
    `SELECT
        t."id",
        ${withCodigo ? 't."codigo",' : ''}
        t."titulo",
        t."descricao",
        t."status"::text as "status",
        t."prioridade"::text as "prioridade",
        t."dataInicio",
        t."dataFim",
        t."clienteId",
        t."solucaoId",
        t."responsavelId",
        u."nomeExibicao" as "responsavelNome",
        u."email" as "responsavelEmail",
        c."nome" as "clienteNome",
        c."empresa" as "clienteEmpresa",
        t."createdAt",
        t."updatedAt"
      FROM "Tarefa" t
      INNER JOIN "Usuario" u ON u."id" = t."responsavelId"
      LEFT JOIN "Cliente" c ON c."id" = t."clienteId"
      ORDER BY t."createdAt" DESC`
  );
  const normalized = rows.map((r) => ({ ...r, codigo: withCodigo ? r.codigo : "" }));
  return attachRelationsToSqlRows(normalized);
}

export async function loadTarefasSafe() {
  try {
    return filterTarefasInternas(
      await prisma.tarefa.findMany({
      include: TAREFA_BOOTSTRAP_INCLUDE,
      orderBy: { createdAt: "desc" },
    })
    );
  } catch (e) {
    console.warn("[tarefas/bootstrap] include completo indisponível; tentando legado.", e);
  }

  try {
    return filterTarefasInternas(
      await prisma.tarefa.findMany({
      include: TAREFA_BOOTSTRAP_INCLUDE_LEGACY,
      orderBy: { createdAt: "desc" },
    })
    );
  } catch (e) {
    console.warn("[tarefas/bootstrap] include legado indisponível; tentando SQL.", e);
  }

  try {
    return filterTarefasInternas(await loadTarefasSql(true));
  } catch (e) {
    console.warn("[tarefas/bootstrap] SQL com codigo falhou; tentando sem codigo.", e);
  }

  try {
    return filterTarefasInternas(await loadTarefasSql(false));
  } catch (e) {
    console.error("[tarefas/bootstrap] falha total ao carregar tarefas.", e);
    return [];
  }
}
