export type OperacionalReportId = "backlog_geral" | "itens_atrasados";
export type OperacionalSituacao = "todos" | "abertos" | "atrasados";

export type OperacionalReportDefinition = {
  id: OperacionalReportId;
  titulo: string;
  descricao: string;
  filtrosSuportados: Array<"cliente" | "periodo" | "situacao">;
  endpointBase: "/api/relatorios/operacional";
};

export const OPERACIONAL_REPORTS: OperacionalReportDefinition[] = [
  {
    id: "backlog_geral",
    titulo: "Backlog geral (Tarefas + Suporte)",
    descricao: "Visão consolidada de volume, status e prioridades no período filtrado.",
    filtrosSuportados: ["cliente", "periodo", "situacao"],
    endpointBase: "/api/relatorios/operacional",
  },
  {
    id: "itens_atrasados",
    titulo: "Itens atrasados (Tarefas + Suporte)",
    descricao: "Destaca pendências vencidas para direcionar ações imediatas por cliente.",
    filtrosSuportados: ["cliente", "periodo", "situacao"],
    endpointBase: "/api/relatorios/operacional",
  },
];

export function getOperacionalReportById(id: string): OperacionalReportDefinition | null {
  return OPERACIONAL_REPORTS.find((item) => item.id === id) ?? null;
}
