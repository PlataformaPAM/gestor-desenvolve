export type FinanceiroReportId = "fluxo_caixa_periodo" | "inadimplencia_clientes";
export type FinanceiroSituacao = "todos" | "pendente" | "atrasado" | "pago";
export type FinanceiroTipo = "todos" | "entrada" | "saida";

export type FinanceiroReportDefinition = {
  id: FinanceiroReportId;
  titulo: string;
  descricao: string;
  filtrosSuportados: Array<"cliente" | "periodo" | "situacao" | "tipo">;
  endpointBase: "/api/relatorios/financeiro";
};

export const FINANCEIRO_REPORTS: FinanceiroReportDefinition[] = [
  {
    id: "fluxo_caixa_periodo",
    titulo: "Fluxo de caixa por período",
    descricao: "Consolida entradas e saídas no período, com totalizadores e saldo operacional.",
    filtrosSuportados: ["cliente", "periodo", "situacao", "tipo"],
    endpointBase: "/api/relatorios/financeiro",
  },
  {
    id: "inadimplencia_clientes",
    titulo: "Inadimplência por cliente",
    descricao: "Lista lançamentos vencidos por cliente e destaca os maiores saldos em atraso.",
    filtrosSuportados: ["cliente", "periodo", "situacao", "tipo"],
    endpointBase: "/api/relatorios/financeiro",
  },
];

export function getFinanceiroReportById(id: string): FinanceiroReportDefinition | null {
  return FINANCEIRO_REPORTS.find((item) => item.id === id) ?? null;
}
