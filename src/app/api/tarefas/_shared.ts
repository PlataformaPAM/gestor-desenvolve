import type { Cliente as PrismaCliente, Tarefa as PrismaTarefa, Usuario as PrismaUsuario } from "@prisma/client";
import type { Tarefa, UsuarioTarefa } from "@/lib/tarefas/types";

type PrismaTarefaCompat = PrismaTarefa & {
  // Em ambientes com cliente Prisma desatualizado, "codigo" pode não estar tipado.
  codigo?: string | null;
};

export function mapUsuarioTarefaFromDb(u: PrismaUsuario): UsuarioTarefa {
  return {
    id: u.id,
    nome: u.nomeExibicao?.trim() || u.email,
  };
}

export function mapTarefaFromDb(
  t: PrismaTarefaCompat & {
    criadoPor?: PrismaUsuario | null;
    responsavel: PrismaUsuario;
    colaboradores: Array<{ usuario: PrismaUsuario }>;
    cliente?: Pick<PrismaCliente, "id" | "nome" | "empresa"> | null;
    clientesVinculados?: Array<{ cliente: Pick<PrismaCliente, "id" | "nome" | "empresa"> }>;
    anexos: Array<{ nomeArquivo: string }>;
    historico: Array<{
      id: string;
      data: Date;
      acao: string;
      autorId: string | null;
      autor: PrismaUsuario | null;
      anexos: Array<{ nomeArquivo: string }>;
    }>;
  }
): Tarefa {
  const clientesVinculados = (t.clientesVinculados ?? [])
    .map((v) => v.cliente)
    .filter(Boolean)
    .map((c) => ({
      id: c.id,
      nomeExibicao: (c.empresa?.trim() || c.nome).trim(),
    }));
  const clienteIds = clientesVinculados.map((c) => c.id);
  const clienteNomeConcat = clientesVinculados.map((c) => c.nomeExibicao).join(", ");

  return {
    id: t.id,
    codigo: t.codigo ?? "",
    titulo: t.titulo,
    descricao: t.descricao ?? undefined,
    status: t.status as Tarefa["status"],
    prioridade: t.prioridade as Tarefa["prioridade"],
    dataInicio: t.dataInicio.toISOString(),
    dataFim: t.dataFim.toISOString(),
    responsavel: mapUsuarioTarefaFromDb(t.responsavel),
    colaboradores: t.colaboradores.map((c) => mapUsuarioTarefaFromDb(c.usuario)),
    clienteId: t.clienteId ?? clienteIds[0] ?? undefined,
    clienteIds,
    clienteNome:
      clienteNomeConcat ||
      (t.cliente ? (t.cliente.empresa?.trim() || t.cliente.nome).trim() : undefined),
    solucaoId: t.solucaoId ?? undefined,
    anexos: t.anexos.map((a) => a.nomeArquivo),
    historico: t.historico.map((h) => ({
      id: h.id,
      data: h.data.toISOString(),
      acao: h.acao,
      autor: h.autor ? mapUsuarioTarefaFromDb(h.autor).nome : undefined,
      autorId: h.autorId ?? undefined,
      anexos: h.anexos.map((a) => a.nomeArquivo),
    })),
    registroCriadoPorNome: t.criadoPor?.nomeExibicao?.trim() || null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

