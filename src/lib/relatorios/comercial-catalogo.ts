export type ComercialReportId = "pipeline_gerencial" | "conversao_funil";
export type ComercialSituacao = "todos" | "abertos" | "ganhos" | "perdidos";

export type ComercialReportDefinition = {
  id: ComercialReportId;
  titulo: string;
  descricao: string;
  filtrosSuportados: Array<"periodo" | "situacao">;
  endpointBase: "/api/relatorios/comercial";
};

export const COMERCIAL_REPORTS: ComercialReportDefinition[] = [
  {
    id: "pipeline_gerencial",
    titulo: "Pipeline gerencial",
    descricao: "Volume por etapa, valor em aberto e desempenho mensal de fechamento.",
    filtrosSuportados: ["periodo", "situacao"],
    endpointBase: "/api/relatorios/comercial",
  },
  {
    id: "conversao_funil",
    titulo: "Conversão do funil",
    descricao: "Taxa de ganho/perda, evolução de leads e distribuição por origem.",
    filtrosSuportados: ["periodo", "situacao"],
    endpointBase: "/api/relatorios/comercial",
  },
];

export function getComercialReportById(id: string): ComercialReportDefinition | null {
  return COMERCIAL_REPORTS.find((item) => item.id === id) ?? null;
}
