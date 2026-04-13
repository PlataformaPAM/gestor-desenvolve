import type { Lead, PapelContatoOportunidade } from "@/lib/comercial/types";
import { ORIGEM_OPCOES, PIPELINE_STAGES, PRIORIDADE_LABELS } from "@/lib/comercial/constants";
import { VARIAVEIS_DOCUMENTO_TODOS } from "@/lib/documentos/template-vars";
import type { EmpresaDocumentoConfig } from "@/lib/documentos/empresa-config";

export type ClienteVariaveisCtx = {
  nomeExibicao: string;
  cpfCnpj: string;
  email?: string | null;
  telefone?: string | null;
  segmento?: string;
  municipioUf?: string;
};

function formatBrl(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function labelEtapa(stageId: Lead["stageId"]): string {
  return PIPELINE_STAGES.find((s) => s.id === stageId)?.label ?? stageId;
}

function labelOrigem(origem: Lead["origem"]): string {
  return ORIGEM_OPCOES.find((o) => o.value === origem)?.label ?? origem;
}

function contatoPorPapel(lead: Lead, papel: PapelContatoOportunidade) {
  return lead.contatosOportunidade?.find((c) => c.papeis.includes(papel));
}

function condicoesPagamentoAgregadas(lead: Lead): string {
  const partes = (lead.solucoes ?? [])
    .map((s) => s.condicoesPagamento?.trim())
    .filter(Boolean) as string[];
  return [...new Set(partes)].join(" Â· ");
}

function formaPagamentoSugerida(lead: Lead): string {
  const recs = (lead.solucoes ?? [])
    .map((s) => s.recorrenciaPagamento)
    .filter(Boolean) as Array<"mensal" | "unica" | "parcelado">;
  if (!recs.length) return "";
  const uniq = [...new Set(recs)];
  const label: Record<"mensal" | "unica" | "parcelado", string> = {
    mensal: "Mensal",
    unica: "Ãšnica",
    parcelado: "Parcelado",
  };
  return uniq.map((r) => label[r]).join(" / ");
}

function solucoesLista(lead: Lead): string {
  return (lead.solucoes ?? [])
    .map((s) => s.nome)
    .filter(Boolean)
    .join(", ");
}

function solucoesDetalhamento(lead: Lead): string {
  return (lead.solucoes ?? [])
    .map((s) => {
      const v = s.valor != null ? formatBrl(s.valor) : "â€”";
      return `${s.nome} â€” ${v}`;
    })
    .join("\n");
}

/**
 * Mapa de substituiÃ§Ã£o para `preencherTemplateDocumento` com dados reais do lead (e cliente vinculado).
 * Tokens sem dado ficam com string vazia; `empresa.*` reservado para configuraÃ§Ã£o futura.
 */
export function montarVariaveisDocumentoParaLead(input: {
  lead: Lead;
  cliente: ClienteVariaveisCtx | null;
  usuario: { nome: string; email: string } | null;
  empresa?: EmpresaDocumentoConfig | null;
  refDate?: Date;
}): Record<string, string> {
  const { lead, cliente, usuario, empresa } = input;
  const ref = input.refDate ?? new Date();
  const h = ref.getHours().toString().padStart(2, "0");
  const min = ref.getMinutes().toString().padStart(2, "0");

  const base: Record<string, string> = Object.fromEntries(VARIAVEIS_DOCUMENTO_TODOS.map((t) => [t, ""]));

  const valorTotal = lead.valorTotal ?? lead.value ?? 0;
  const gp = contatoPorPapel(lead, "gestor_principal");
  const gc = contatoPorPapel(lead, "gestor_contrato");
  const gf = contatoPorPapel(lead, "gestor_financeiro");
  const tech = contatoPorPapel(lead, "tecnico");

  const fin = lead.financeiroFluxo;

  Object.assign(base, {
    "{{empresa.razaoSocial}}": empresa?.razaoSocial?.trim() ?? "",
    "{{empresa.nomeFantasia}}": empresa?.nomeFantasia?.trim() ?? "",
    "{{empresa.cnpj}}": empresa?.cnpj?.trim() ?? "",
    "{{empresa.telefone}}": empresa?.telefone?.trim() ?? "",
    "{{empresa.email}}": empresa?.email?.trim() ?? "",
    "{{empresa.site}}": empresa?.site?.trim() ?? "",
    "{{empresa.endereco}}": empresa?.endereco?.trim() ?? "",

    "{{cliente.nome}}": cliente?.nomeExibicao ?? "",
    "{{cliente.cpfCnpj}}": cliente?.cpfCnpj ?? "",
    "{{cliente.email}}": cliente?.email?.trim() ?? "",
    "{{cliente.telefone}}": cliente?.telefone?.trim() ?? "",
    "{{cliente.segmento}}": cliente?.segmento ?? "",
    "{{cliente.municipioUf}}": cliente?.municipioUf ?? "",

    "{{lead.titulo}}": lead.name ?? "",
    "{{lead.descricao}}": lead.notes?.trim() ?? "",
    "{{lead.valorTotal}}": formatBrl(valorTotal),
    "{{lead.condicoesPagamento}}": condicoesPagamentoAgregadas(lead),
    "{{lead.prazoValidade}}": ref
      ? new Date(ref.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR")
      : "",
    "{{lead.origem}}": labelOrigem(lead.origem),
    "{{lead.etapa}}": labelEtapa(lead.stageId),
    "{{lead.prioridade}}": PRIORIDADE_LABELS[lead.priority] ?? lead.priority,
    "{{lead.previsaoFechamento}}": lead.previsaoFechamento
      ? new Date(lead.previsaoFechamento + "T12:00:00").toLocaleDateString("pt-BR")
      : "",
    "{{lead.contatoPrincipal}}": lead.contact?.trim() ?? gp?.nome ?? "",
    "{{lead.email}}": lead.email?.trim() ?? "",
    "{{lead.telefone}}": lead.phone?.trim() ?? "",
    "{{lead.empresa}}": lead.company?.trim() ?? lead.entidade?.trim() ?? "",
    "{{lead.municipioUf}}": lead.municipioUf?.trim() ?? "",

    "{{solucoes.lista}}": solucoesLista(lead),
    "{{solucoes.total}}": formatBrl(valorTotal),
    "{{solucoes.detalhamento}}": solucoesDetalhamento(lead),

    "{{contato.gestorPrincipal.nome}}": gp?.nome ?? "",
    "{{contato.gestorPrincipal.email}}": gp?.email ?? "",
    "{{contato.gestorContrato.nome}}": gc?.nome ?? "",
    "{{contato.gestorFinanceiro.nome}}": gf?.nome ?? "",
    "{{contato.tecnico.nome}}": tech?.nome ?? "",

    "{{usuario.nome}}": usuario?.nome?.trim() ?? "",
    "{{usuario.email}}": usuario?.email?.trim() ?? "",
    "{{data.hoje}}": ref.toLocaleDateString("pt-BR"),
    "{{data.hora}}": `${h}:${min}`,
    "{{data.ano}}": String(ref.getFullYear()),

    "{{financeiro.formaPagamento}}": formaPagamentoSugerida(lead),
    "{{financeiro.observacoes}}": fin?.motivoDevolucao?.trim() ?? fin?.motivoSolicitacaoLiberacao?.trim() ?? "",

    "{{rh.colaborador.nome}}": "",
    "{{rh.colaborador.cargo}}": "",
    "{{rh.colaborador.email}}": "",
  });

  return base;
}
