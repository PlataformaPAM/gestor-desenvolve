import type { Cliente as PrismaCliente, Tarefa as PrismaTarefa, Usuario as PrismaUsuario } from "@prisma/client";
import type { Tarefa, UsuarioTarefa } from "@/lib/tarefas/types";
import { normalizeCategoriaTarefa, splitDescricaoCategoria } from "@/lib/tarefas/categorias";
import { buildAnexoItens } from "@/lib/tarefas/anexos";

type PrismaTarefaCompat = PrismaTarefa & {
  codigo?: string | null;
};

function normalizeStatus(status: unknown): Tarefa["status"] {
  const raw = String(status ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
  if (raw === "concluido" || raw === "concluida" || raw === "done") return "concluido";
  if (raw === "cancelado" || raw === "cancelada") return "cancelado";
  if (raw === "validar" || raw === "validacao") return "validar";
  if (raw === "em_andamento" || raw === "em andamento" || raw === "andamento" || raw === "doing") {
    return "em_andamento";
  }
  if (
    raw === "aguardando" ||
    raw === "impedimento" ||
    raw === "impedido" ||
    raw === "blocked"
  ) {
    return "aguardando";
  }
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

type TarefaHistoricoAnexoDb = {
  nomeArquivo: string;
};

type TarefaHistoricoDb = {
  id: string;
  data: Date;
  acao: string;
  autorId: string | null;
  autor: PrismaUsuario | null;
  anexos: TarefaHistoricoAnexoDb[];
};

type TarefaAnexoDb = {
  nomeArquivo: string;
  url?: string | null;
};

type TarefaFromDbInput = PrismaTarefaCompat & {
  criadoPor?: PrismaUsuario | null;
  responsavel: PrismaUsuario;
  colaboradores: Array<{ usuario: PrismaUsuario }>;
  cliente?: Pick<PrismaCliente, "id" | "nome" | "empresa"> | null;
  clientesVinculados?: Array<{ cliente: Pick<PrismaCliente, "id" | "nome" | "empresa"> }>;
  solucoesVinculadas?: Array<{ solucaoCatalogo: { id: string; nome: string } }>;
  anexos: TarefaAnexoDb[];
  historico: TarefaHistoricoDb[];
};

export function mapTarefaFromDb(t: TarefaFromDbInput): Tarefa {
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
  const solucoes = (t.solucoesVinculadas ?? []).map((s) => ({
    id: s.solucaoCatalogo.id,
    nome: s.solucaoCatalogo.nome,
  }));
  const solucaoIds = solucoes.map((s) => s.id);
  const anexoNomes = t.anexos.map((a) => a.nomeArquivo);

  return {
    id: t.id,
    codigo: t.codigo ?? "",
    categoria: normalizeCategoriaTarefa(parsedDescricao.categoria) ?? parsedDescricao.categoria,
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
    solucaoId: t.solucaoId ?? solucaoIds[0] ?? undefined,
    solucaoIds,
    solucoes,
    anexos: anexoNomes,
    anexoItens: buildAnexoItens(
      anexoNomes,
      t.id,
      t.anexos.map((a) => ({ name: a.nomeArquivo, url: a.url ?? undefined }))
    ),
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
