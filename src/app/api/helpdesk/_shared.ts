import type { HelpdeskTicket, Usuario } from "@prisma/client";
import type { Ticket } from "@/lib/suporte/types";

export function mapTicketFromDb(
  t: HelpdeskTicket & {
    criadoPor?: Usuario | null;
    cliente: { nome: string; empresa: string };
    responsaveis: Array<{ usuario: Usuario }>;
    historico: Array<{
      id: string;
      data: Date;
      acao: string;
      detalhe: string | null;
      autor: Usuario | null;
      anexos: Array<{ nomeArquivo: string }>;
    }>;
    comentarios: Array<{
      id: string;
      autorNomeSnapshot: string;
      autorTipo: string;
      texto: string;
      data: Date;
      anexos: Array<{ nomeArquivo: string }>;
    }>;
    anexos: Array<{ nomeArquivo: string }>;
  }
): Ticket {
  return {
    id: t.codigo,
    clienteId: t.clienteId,
    clienteNome: t.cliente.empresa || t.cliente.nome,
    assunto: t.assunto,
    descricao: t.descricao,
    status: t.status as Ticket["status"],
    prioridade: t.prioridade as Ticket["prioridade"],
    categoria: t.categoria as Ticket["categoria"],
    responsaveis: t.responsaveis.map((r) => ({
      id: r.usuario.id,
      nome: r.usuario.nomeExibicao?.trim() || r.usuario.email,
    })),
    dataCriacao: t.dataCriacao.toISOString(),
    previsaoConclusao: t.previsaoConclusao.toISOString(),
    ultimaAtualizacao: t.ultimaAtualizacao.toISOString(),
    historico: t.historico.map((h) => ({
      id: h.id,
      data: h.data.toISOString(),
      acao: h.acao,
      autor: h.autor?.nomeExibicao || undefined,
      detalhe: h.detalhe || undefined,
      anexos: h.anexos.map((a) => a.nomeArquivo),
    })),
    comentarios: t.comentarios.map((c) => ({
      id: c.id,
      autor: c.autorNomeSnapshot,
      autorTipo: c.autorTipo as Ticket["comentarios"][number]["autorTipo"],
      texto: c.texto,
      data: c.data.toISOString(),
      anexos: c.anexos.map((a) => a.nomeArquivo),
    })),
    arquivos: undefined,
    registroCriadoPorNome: t.criadoPor?.nomeExibicao?.trim() || null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

