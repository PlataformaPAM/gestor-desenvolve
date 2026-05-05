import type { Cliente as PrismaCliente, Tarefa as PrismaTarefa, Usuario as PrismaUsuario } from "@prisma/client";
import type { Tarefa, UsuarioTarefa } from "@/lib/tarefas/types";
import { splitDescricaoCategoria } from "@/lib/tarefas/categorias";

type PrismaTarefaCompat = PrismaTarefa & {
  // Em ambientes com cliente Prisma desatualizado, "codigo" pode não estar tipado.
  codigo?: string | null;
};

function normalizeStatus(status: unknown): Tarefa["status"] {
  const raw = String(status ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
  if (raw === "concluido" || raw === "concluida" || raw === "done") return "concluido";
  if (raw === "em_andamento" || raw === "em andamento" || raw === "andamento" || raw === "doing") {
    return "em_andamento";
  }
  if (raw === "impedimento" || raw === "impedido" || raw === "blocked") return "impedimento";
  return "a_fazer";
}

function normalizePrioridade(prioridade: unknown): Tarefa["prioridade"] {
  const raw = String(prioridade ?? "").toLowerCase().trim();
  if (raw === "urgente") return "urgente";
  if (raw === "alta") return "alta";
  if (raw === "baixa") return "baixa";
  return "media";
}

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
  const parsedDescricao = splitDescricaoCategoria(t.descricao);
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
    categoria: parsedDescricao.categoria,
    titulo: t.titulo,
    descricao: parsedDescricao.descricao,
    status: normalizeStatus(t.status),
    prioridade: normalizePrioridade(t.prioridade),
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

