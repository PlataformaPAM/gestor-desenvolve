import { prisma } from "@/lib/prisma";
import { mapTarefaFromDb } from "../_shared";
import { ok } from "@/lib/server/api-response";
import { filterTarefasForSession, tarefasAccessGate } from "@/lib/server/tarefas-access";
import { loadUsuariosAtivosParaVinculo } from "@/lib/server/usuarios-ativos";

export async function GET(req: Request) {
  const gate = await tarefasAccessGate(req, "ver");
  if (!gate.ok) return gate.response;
  const [mappedUsuarios, tarefas] = await Promise.all([
    loadUsuariosAtivosParaVinculo(),
    loadTarefasSafe(),
  ]);
  const mappedTarefas = filterTarefasForSession(
    tarefas
      .map((t) => {
        try {
          return mapTarefaFromDb(t as Parameters<typeof mapTarefaFromDb>[0]);
        } catch (e) {
          console.warn("[tarefas/bootstrap] falha ao mapear tarefa; item ignorado.", e);
          return null;
        }
      })
      .filter((t): t is NonNullable<typeof t> => t != null),
    gate.session,
    gate.userId
  );
  return ok({
    usuarios: mappedUsuarios,
    tarefas: mappedTarefas,
    data: { usuarios: mappedUsuarios, tarefas: mappedTarefas },
  });
}

async function loadTarefasSafe() {
  try {
    return await prisma.tarefa.findMany({
      include: {
        criadoPor: true,
        cliente: { select: { id: true, nome: true, empresa: true } },
        clientesVinculados: { include: { cliente: { select: { id: true, nome: true, empresa: true } } } },
        responsavel: true,
        colaboradores: { include: { usuario: true } },
        anexos: true,
        historico: { include: { autor: true, anexos: true }, orderBy: { data: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (e) {
    console.warn(
      "[tarefas/bootstrap] include clientesVinculados indisponível no banco; fallback para cliente único.",
      e
    );
  }

  try {
    return await prisma.tarefa.findMany({
      include: {
        criadoPor: true,
        cliente: { select: { id: true, nome: true, empresa: true } },
        responsavel: true,
        colaboradores: { include: { usuario: true } },
        anexos: true,
        historico: { include: { autor: true, anexos: true }, orderBy: { data: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (e) {
    console.error("[tarefas/bootstrap] falha ao carregar tarefas; retornando lista vazia.", e);
  }

  // Fallback SQL para ambientes com schema legado (ex.: sem coluna "codigo").
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{
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
    }>>(
      `SELECT
        t."id",
        t."codigo",
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
      colaboradores: [],
      anexos: [],
      historico: [],
      cliente: r.clienteId
        ? {
            id: r.clienteId,
            nome: r.clienteNome ?? "",
            empresa: r.clienteEmpresa,
          }
        : null,
      clientesVinculados: [],
    }));
  } catch (rawErrWithCodigo) {
    console.warn("[tarefas/bootstrap] fallback SQL com codigo falhou; tentando sem codigo.", rawErrWithCodigo);
  }

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{
      id: string;
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
    }>>(
      `SELECT
        t."id",
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
    return rows.map((r) => ({
      id: r.id,
      codigo: "",
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
      colaboradores: [],
      anexos: [],
      historico: [],
      cliente: r.clienteId
        ? {
            id: r.clienteId,
            nome: r.clienteNome ?? "",
            empresa: r.clienteEmpresa,
          }
        : null,
      clientesVinculados: [],
    }));
  } catch (rawErrNoCodigo) {
    console.error("[tarefas/bootstrap] falha total ao carregar tarefas.", rawErrNoCodigo);
    return [];
  }
}

