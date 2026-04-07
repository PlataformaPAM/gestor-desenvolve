import type { Tarefa as PrismaTarefa, Usuario as PrismaUsuario } from "@prisma/client";
import type { Tarefa, UsuarioTarefa } from "@/lib/tarefas/types";

export function mapUsuarioTarefaFromDb(u: PrismaUsuario): UsuarioTarefa {
  return {
    id: u.id,
    nome: u.nomeExibicao?.trim() || u.email,
  };
}

export function mapTarefaFromDb(
  t: PrismaTarefa & {
    criadoPor?: PrismaUsuario | null;
    responsavel: PrismaUsuario;
    colaboradores: Array<{ usuario: PrismaUsuario }>;
    anexos: Array<{ nomeArquivo: string }>;
    historico: Array<{
      id: string;
      data: Date;
      acao: string;
      autor: PrismaUsuario | null;
      anexos: Array<{ nomeArquivo: string }>;
    }>;
  }
): Tarefa {
  return {
    id: t.id,
    titulo: t.titulo,
    descricao: t.descricao ?? undefined,
    status: t.status as Tarefa["status"],
    prioridade: t.prioridade as Tarefa["prioridade"],
    dataInicio: t.dataInicio.toISOString(),
    dataFim: t.dataFim.toISOString(),
    responsavel: mapUsuarioTarefaFromDb(t.responsavel),
    colaboradores: t.colaboradores.map((c) => mapUsuarioTarefaFromDb(c.usuario)),
    clienteId: t.clienteId ?? undefined,
    solucaoId: t.solucaoId ?? undefined,
    anexos: t.anexos.map((a) => a.nomeArquivo),
    historico: t.historico.map((h) => ({
      id: h.id,
      data: h.data.toISOString(),
      acao: h.acao,
      autor: h.autor ? mapUsuarioTarefaFromDb(h.autor).nome : undefined,
      anexos: h.anexos.map((a) => a.nomeArquivo),
    })),
    registroCriadoPorNome: t.criadoPor?.nomeExibicao?.trim() || null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

