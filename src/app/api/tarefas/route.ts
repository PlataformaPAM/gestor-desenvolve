import { prisma } from "@/lib/prisma";
import type { Tarefa } from "@/lib/tarefas/types";
import { mapTarefaFromDb } from "./_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { emitAlert } from "@/lib/server/alerts";
import { Prisma } from "@prisma/client";

type TxTarefaCompat = {
  tarefa: {
    findFirst: (args: unknown) => Promise<unknown>;
  };
};

type FallbackSavedTarefa = {
  id: string;
  codigo: string;
  titulo: string;
  descricao?: string;
  status: Tarefa["status"];
  prioridade: Tarefa["prioridade"];
  dataInicio: string;
  dataFim: string;
  responsavel: { id: string; nome: string };
  colaboradores: { id: string; nome: string }[];
  clienteId?: string;
  clienteIds: string[];
  clienteNome?: string;
  solucaoId?: string;
  anexos: string[];
  historico: Tarefa["historico"];
  registroCriadoPorNome?: string | null;
  createdAt: string;
  updatedAt: string;
};

function buildHistoricoId(tarefaId: string, index: number): string {
  return `${tarefaId}-h-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildCodigoFrom(ano: number, sequencial: number): string {
  return `TAR-${ano}-${String(sequencial).padStart(4, "0")}`;
}

function extractPersistErrorMessage(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const target = Array.isArray(error.meta?.target)
      ? error.meta?.target.join(", ")
      : typeof error.meta?.target === "string"
        ? error.meta.target
        : "";
    const cause = typeof error.meta?.cause === "string" ? error.meta.cause : "";
    const detail = [target ? `target: ${target}` : "", cause].filter(Boolean).join(" | ");
    return detail ? `Erro ${error.code} - ${detail}` : `Erro ${error.code}`;
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return `Erro de validação do Prisma: ${error.message}`;
  }
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return "erro desconhecido";
  }
}

async function proximoCodigoTarefa(
  tx: TxTarefaCompat,
  ano: number
): Promise<string> {
  const prefixo = `TAR-${ano}-`;
  try {
    const ultimo = (await tx.tarefa.findFirst({
      where: { codigo: { startsWith: prefixo } },
      orderBy: { codigo: "desc" },
      select: { codigo: true },
    })) as { codigo?: string } | null;
    const ultimoSequencial = Number.parseInt(ultimo?.codigo?.slice(-4) ?? "0", 10);
    return buildCodigoFrom(ano, Number.isFinite(ultimoSequencial) ? ultimoSequencial + 1 : 1);
  } catch (error) {
    // Fallback para não bloquear criação se a consulta do último código falhar.
    console.warn("[tarefas/create] não foi possível consultar último código TAR; usando fallback.", error);
    const seed = Number.parseInt(String(Date.now()).slice(-4), 10);
    return buildCodigoFrom(ano, Number.isFinite(seed) ? seed : 1);
  }
}

export async function POST(req: Request) {
  const parsed = await parseJsonSafe<{ tarefa?: Tarefa }>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const tarefa = parsed.value.tarefa;
  if (!tarefa?.id || !tarefa.responsavel?.id) {
    return fail("BAD_REQUEST", "Payload de tarefa inválido.", 400);
  }

  let created = false;
  let lastCreateError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await prisma.$transaction(async (tx) => {
        const now = new Date();
        const codigo = await proximoCodigoTarefa(tx as unknown as TxTarefaCompat, now.getFullYear());

    const autorIds = Array.from(
      new Set(
        (tarefa.historico ?? [])
          .map((h) => h.autorId?.trim() ?? "")
          .filter((autorId) => Boolean(autorId))
      )
    );
    const autoresValidos = new Set(
      autorIds.length
        ? (
            await tx.usuario.findMany({
              where: { id: { in: autorIds } },
              select: { id: true },
            })
          ).map((u) => u.id)
        : []
    );

    const data: Record<string, unknown> = {
      id: tarefa.id,
      codigo,
      titulo: tarefa.titulo,
      descricao: tarefa.descricao ?? null,
      status: tarefa.status,
      prioridade: tarefa.prioridade,
      dataInicio: new Date(tarefa.dataInicio),
      dataFim: new Date(tarefa.dataFim),
      clienteId: tarefa.clienteId ?? null,
      solucaoId: tarefa.solucaoId ?? null,
      responsavelId: tarefa.responsavel.id,
    };
    await tx.tarefa.create({
      data: data as unknown as Prisma.TarefaCreateArgs["data"],
    });

    if (tarefa.colaboradores?.length) {
      await tx.tarefaColaborador.createMany({
        data: tarefa.colaboradores.map((c) => ({ tarefaId: tarefa.id, usuarioId: c.id })),
      });
    }
    const clienteIds = Array.from(new Set((tarefa.clienteIds ?? [tarefa.clienteId]).filter(Boolean) as string[]));
    if (clienteIds.length) {
      try {
        await tx.tarefaCliente.createMany({
          data: clienteIds.map((clienteId) => ({ tarefaId: tarefa.id, clienteId })),
        });
      } catch (error) {
        // Não aborta criação por falha no vínculo N:N; clienteId principal já foi salvo em Tarefa.
        console.warn("[tarefas/create] falha ao salvar clientes vinculados; mantendo tarefa criada.", error);
      }
    }

    if (tarefa.anexos?.length) {
      await tx.tarefaAnexo.createMany({
        data: tarefa.anexos.map((nomeArquivo) => ({ tarefaId: tarefa.id, nomeArquivo, url: null })),
      });
    }

    for (const [index, h] of (tarefa.historico ?? []).entries()) {
      const autorId = h.autorId?.trim() ?? "";
      await tx.tarefaHistorico.create({
        data: {
          id: buildHistoricoId(tarefa.id, index),
          tarefaId: tarefa.id,
          data: new Date(h.data),
          acao: h.acao,
          autorId: autorId && autoresValidos.has(autorId) ? autorId : null,
          anexos: {
            create: (h.anexos ?? []).map((nomeArquivo) => ({ nomeArquivo, url: null })),
          },
        },
      });
    }
      });
      created = true;
      break;
    } catch (error) {
      const target =
        error instanceof Prisma.PrismaClientKnownRequestError ? error.meta?.target : undefined;
      const targetIncludesCodigo = Array.isArray(target)
        ? target.includes("codigo")
        : typeof target === "string"
          ? target.includes("codigo")
          : false;
      const isUniqueCodigoConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        targetIncludesCodigo;
      if (!isUniqueCodigoConflict || attempt === 4) {
        lastCreateError = error;
        break;
      }
    }
  }

  if (!created) {
    console.error("[tarefas/create] falha na criação completa; tentando fallback mínimo.", lastCreateError);
    try {
      const now = new Date();
      const codigoFallback = buildCodigoFrom(now.getFullYear(), Number.parseInt(String(Date.now()).slice(-4), 10) || 1);
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "Tarefa" ("id","codigo","titulo","descricao","status","prioridade","dataInicio","dataFim","clienteId","solucaoId","responsavelId","createdAt","updatedAt")
           VALUES ($1,$2,$3,$4,$5::"TarefaStatus",$6::"TarefaPrioridade",$7,$8,$9,$10,$11,$12,$13)`,
          tarefa.id,
          codigoFallback,
          tarefa.titulo,
          tarefa.descricao ?? null,
          tarefa.status,
          tarefa.prioridade,
          new Date(tarefa.dataInicio),
          new Date(tarefa.dataFim),
          tarefa.clienteId ?? null,
          tarefa.solucaoId ?? null,
          tarefa.responsavel.id,
          now,
          now
        );
      } catch (withCodigoError) {
        console.warn("[tarefas/create] insert com codigo falhou; tentando sem codigo.", withCodigoError);
        await prisma.$executeRawUnsafe(
          `INSERT INTO "Tarefa" ("id","titulo","descricao","status","prioridade","dataInicio","dataFim","clienteId","solucaoId","responsavelId","createdAt","updatedAt")
           VALUES ($1,$2,$3,$4::"TarefaStatus",$5::"TarefaPrioridade",$6,$7,$8,$9,$10,$11,$12)`,
          tarefa.id,
          tarefa.titulo,
          tarefa.descricao ?? null,
          tarefa.status,
          tarefa.prioridade,
          new Date(tarefa.dataInicio),
          new Date(tarefa.dataFim),
          tarefa.clienteId ?? null,
          tarefa.solucaoId ?? null,
          tarefa.responsavel.id,
          now,
          now
        );
      }
    } catch (fallbackError) {
      console.error("[tarefas/create] fallback mínimo também falhou.", fallbackError);
      const detail = extractPersistErrorMessage(fallbackError);
      return fail("INTERNAL_ERROR", `Falha ao persistir tarefa: ${detail}`, 500);
    }
  }

  let saved: any;
  let savedFallback: FallbackSavedTarefa | null = null;
  try {
    saved = await prisma.tarefa.findUniqueOrThrow({
      where: { id: tarefa.id },
      include: {
        cliente: { select: { id: true, nome: true, empresa: true } },
        clientesVinculados: { include: { cliente: { select: { id: true, nome: true, empresa: true } } } },
        responsavel: true,
        colaboradores: { include: { usuario: true } },
        anexos: true,
        historico: { include: { autor: true, anexos: true }, orderBy: { data: "asc" } },
      },
    });
  } catch (error) {
    console.warn("[tarefas/create] include completo indisponível; usando fallback de leitura.", error);
    try {
      saved = await prisma.tarefa.findUniqueOrThrow({
        where: { id: tarefa.id },
        include: {
          cliente: { select: { id: true, nome: true, empresa: true } },
          responsavel: true,
          colaboradores: { include: { usuario: true } },
          anexos: true,
          historico: { include: { autor: true, anexos: true }, orderBy: { data: "asc" } },
        },
      });
    } catch (fallbackReadError) {
      console.warn("[tarefas/create] leitura Prisma indisponível; retornando payload fallback.", fallbackReadError);
      const responsavelNome =
        (await prisma.usuario
          .findUnique({ where: { id: tarefa.responsavel.id }, select: { nomeExibicao: true, email: true } })
          .then((u) => u?.nomeExibicao?.trim() || u?.email || tarefa.responsavel.nome)
          .catch(() => tarefa.responsavel.nome)) || "Responsável";
      const nowIso = new Date().toISOString();
      savedFallback = {
        id: tarefa.id,
        codigo: "",
        titulo: tarefa.titulo,
        descricao: tarefa.descricao ?? undefined,
        status: tarefa.status,
        prioridade: tarefa.prioridade,
        dataInicio: new Date(tarefa.dataInicio).toISOString(),
        dataFim: new Date(tarefa.dataFim).toISOString(),
        responsavel: { id: tarefa.responsavel.id, nome: responsavelNome },
        colaboradores: tarefa.colaboradores ?? [],
        clienteId: tarefa.clienteId ?? undefined,
        clienteIds: (tarefa.clienteIds ?? [tarefa.clienteId].filter(Boolean)) as string[],
        clienteNome: undefined,
        solucaoId: tarefa.solucaoId ?? undefined,
        anexos: tarefa.anexos ?? [],
        historico: tarefa.historico ?? [],
        registroCriadoPorNome: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    }
  }
  const persistedForSideEffects = savedFallback ?? (saved ? mapTarefaFromDb(saved) : null);
  if (!persistedForSideEffects) {
    return fail("INTERNAL_ERROR", "Falha ao carregar tarefa após persistência.", 500);
  }

  await writeAuditLog(prisma, {
    acao: "Tarefa criada",
    modulo: "tarefas",
    detalhes: `Tarefa ${persistedForSideEffects.titulo} (${persistedForSideEffects.id})`,
  });
  try {
    await emitAlert(prisma, {
      modulo: "tarefas",
      titulo: "Nova tarefa interna criada",
      descricao: `Tarefa "${persistedForSideEffects.titulo}" criada para acompanhamento da equipe.`,
      dedupeKey: `tarefa-criada-${persistedForSideEffects.id}`,
    });
  } catch (error) {
    // Alerta não pode impedir persistência da tarefa em produção.
    console.error("[tarefas/create] falha ao emitir alerta:", error);
  }
  return ok({ tarefa: persistedForSideEffects }, 201);
}

