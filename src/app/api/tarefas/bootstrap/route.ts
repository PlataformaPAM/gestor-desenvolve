import { prisma } from "@/lib/prisma";
import { mapTarefaFromDb, mapUsuarioTarefaFromDb } from "../_shared";
import { ok } from "@/lib/server/api-response";

export async function GET() {
  const [usuarios, tarefas] = await Promise.all([
    prisma.usuario.findMany({
      where: { ativo: true },
      orderBy: { nomeExibicao: "asc" },
    }),
    prisma.tarefa.findMany({
      include: {
        criadoPor: true,
        responsavel: true,
        colaboradores: { include: { usuario: true } },
        anexos: true,
        historico: { include: { autor: true, anexos: true }, orderBy: { data: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const mappedUsuarios = usuarios.map(mapUsuarioTarefaFromDb);
  const mappedTarefas = tarefas.map(mapTarefaFromDb);
  return ok({
    usuarios: mappedUsuarios,
    tarefas: mappedTarefas,
    data: { usuarios: mappedUsuarios, tarefas: mappedTarefas },
  });
}

