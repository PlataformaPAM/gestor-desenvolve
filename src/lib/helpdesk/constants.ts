import type { Ticket, TicketCategoria } from "./types";

export function getSlaEstado(previsaoConclusao: string): "no_prazo" | "atencao" | "atrasado" {
  const previsao = new Date(previsaoConclusao).getTime();
  const now = Date.now();
  const diffMs = previsao - now;
  const diffHoras = diffMs / (1000 * 60 * 60);
  if (diffMs < 0) return "atrasado";
  if (diffHoras <= 24) return "atencao";
  return "no_prazo";
}

export function generateTicketId(tickets: Ticket[]): string {
  const ano = new Date().getFullYear();
  const prefix = `SUP-${ano}-`;
  const nums = tickets
    .filter((t) => t.id.startsWith(prefix))
    .map((t) => {
      const n = t.id.slice(prefix.length);
      const parsed = parseInt(n, 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    });
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export const PRIORIDADE_LABELS: Record<Ticket["prioridade"], string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export const STATUS_LABELS: Record<Ticket["status"], string> = {
  novo: "Novo",
  em_andamento: "Em andamento",
  aguardando_cliente: "Aguardando cliente",
  aguardando_equipe: "Aguardando equipe",
  pendente: "Pendente",
  respondido: "Respondido",
  finalizado: "Finalizado",
  nao_solucionado: "Não solucionado",
};

export const CATEGORIA_LABELS: Record<TicketCategoria, string> = {
  comercial: "Comercial",
  financeiro: "Financeiro",
  suporte_tecnico: "Suporte Técnico",
  duvida: "Dúvida",
  sugestao: "Sugestão",
};
