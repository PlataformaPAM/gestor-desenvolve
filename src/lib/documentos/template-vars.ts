/**
 * Variáveis dos modelos do Construtor de Documentos.
 * Formato: {{grupo.campo}} (espaços opcionais dentro das chaves).
 * Etapas futuras preenchem tokens com dados reais (lead, cliente, etc.).
 */

export type VariavelDocumentoDef = {
  token: string;
  /** Rótulo curto na UI */
  label: string;
};

export type ModuloVariaveisDocumento = {
  id: string;
  titulo: string;
  variaveis: VariavelDocumentoDef[];
};

/** Organização / dados fixos (cabeçalho, rodapé, contrato da empresa). */
const MODULO_EMPRESA: ModuloVariaveisDocumento = {
  id: "empresa",
  titulo: "Empresa",
  variaveis: [
    { token: "{{empresa.razaoSocial}}", label: "Razão social" },
    { token: "{{empresa.nomeFantasia}}", label: "Nome fantasia" },
    { token: "{{empresa.cnpj}}", label: "CNPJ" },
    { token: "{{empresa.telefone}}", label: "Telefone" },
    { token: "{{empresa.email}}", label: "E-mail" },
    { token: "{{empresa.site}}", label: "Site" },
    { token: "{{empresa.endereco}}", label: "Endereço completo" },
  ],
};

const MODULO_CLIENTE: ModuloVariaveisDocumento = {
  id: "cliente",
  titulo: "Cliente",
  variaveis: [
    { token: "{{cliente.nome}}", label: "Nome / razão social" },
    { token: "{{cliente.cpfCnpj}}", label: "CPF/CNPJ" },
    { token: "{{cliente.email}}", label: "E-mail" },
    { token: "{{cliente.telefone}}", label: "Telefone" },
    { token: "{{cliente.segmento}}", label: "Segmento" },
    { token: "{{cliente.municipioUf}}", label: "Município/UF" },
  ],
};

const MODULO_COMERCIAL: ModuloVariaveisDocumento = {
  id: "comercial",
  titulo: "Comercial (lead)",
  variaveis: [
    { token: "{{lead.titulo}}", label: "Título da oportunidade" },
    { token: "{{lead.descricao}}", label: "Descrição" },
    { token: "{{lead.valorTotal}}", label: "Valor total" },
    { token: "{{lead.condicoesPagamento}}", label: "Condições de pagamento" },
    { token: "{{lead.prazoValidade}}", label: "Prazo de validade" },
    { token: "{{lead.origem}}", label: "Origem" },
    { token: "{{lead.etapa}}", label: "Etapa do funil" },
    { token: "{{lead.prioridade}}", label: "Prioridade" },
    { token: "{{lead.previsaoFechamento}}", label: "Previsão de fechamento" },
    { token: "{{lead.contatoPrincipal}}", label: "Contato principal" },
    { token: "{{lead.email}}", label: "E-mail (lead)" },
    { token: "{{lead.telefone}}", label: "Telefone (lead)" },
    { token: "{{lead.empresa}}", label: "Empresa (nome)" },
    { token: "{{lead.municipioUf}}", label: "Município/UF (lead)" },
  ],
};

const MODULO_SOLUCOES: ModuloVariaveisDocumento = {
  id: "solucoes",
  titulo: "Soluções",
  variaveis: [
    { token: "{{solucoes.lista}}", label: "Lista de soluções" },
    { token: "{{solucoes.total}}", label: "Soma valores" },
    { token: "{{solucoes.detalhamento}}", label: "Detalhamento (nome + valor)" },
  ],
};

const MODULO_CONTATO: ModuloVariaveisDocumento = {
  id: "contato",
  titulo: "Contatos na oportunidade",
  variaveis: [
    { token: "{{contato.gestorPrincipal.nome}}", label: "Gestor principal â€” nome" },
    { token: "{{contato.gestorPrincipal.email}}", label: "Gestor principal â€” e-mail" },
    { token: "{{contato.gestorContrato.nome}}", label: "Gestor contrato â€” nome" },
    { token: "{{contato.gestorFinanceiro.nome}}", label: "Gestor financeiro â€” nome" },
    { token: "{{contato.tecnico.nome}}", label: "Técnico — nome" },
  ],
};

const MODULO_USUARIO_DATA: ModuloVariaveisDocumento = {
  id: "usuario_data",
  titulo: "Usuário e data",
  variaveis: [
    { token: "{{usuario.nome}}", label: "Nome do usuário logado" },
    { token: "{{usuario.email}}", label: "E-mail do usuário" },
    { token: "{{data.hoje}}", label: "Data de hoje" },
    { token: "{{data.hora}}", label: "Hora atual" },
    { token: "{{data.ano}}", label: "Ano atual" },
  ],
};

const MODULO_FINANCEIRO: ModuloVariaveisDocumento = {
  id: "financeiro",
  titulo: "Financeiro",
  variaveis: [
    { token: "{{financeiro.formaPagamento}}", label: "Forma de pagamento" },
    { token: "{{financeiro.observacoes}}", label: "Observações financeiras" },
  ],
};

const MODULO_RH: ModuloVariaveisDocumento = {
  id: "rh",
  titulo: "RH / Fornecedor",
  variaveis: [
    { token: "{{rh.colaborador.nome}}", label: "Nome (colaborador/fornecedor)" },
    { token: "{{rh.colaborador.cargo}}", label: "Cargo/função" },
    { token: "{{rh.colaborador.email}}", label: "E-mail" },
  ],
};

const MODULO_RELATORIOS_PRESTACAO_CONTAS: ModuloVariaveisDocumento = {
  id: "relatorios_prestacao_contas",
  titulo: "Relatórios · Prestação de Contas",
  variaveis: [
    { token: "{{cliente_nome}}", label: "Cliente (relatório)" },
    { token: "{{periodo_inicio}}", label: "Período inicial" },
    { token: "{{periodo_fim}}", label: "Período final" },
    { token: "{{resumo_total_tarefas}}", label: "Resumo: total de tarefas" },
    { token: "{{resumo_total_tickets}}", label: "Resumo: total de tickets" },
    { token: "{{resumo_tarefas_atrasadas}}", label: "Resumo: tarefas atrasadas" },
    { token: "{{resumo_tickets_atrasados}}", label: "Resumo: tickets atrasados" },
    { token: "{{tabela_tarefas_html}}", label: "Tabela: tarefas" },
    { token: "{{tabela_tickets_html}}", label: "Tabela: tickets" },
    { token: "{{tabela_tarefas_detalhada_html}}", label: "Tabela: tarefas detalhadas" },
    { token: "{{tabela_tickets_detalhada_html}}", label: "Tabela: tickets detalhados" },
  ],
};

const MODULO_RELATORIOS_OPERACIONAL: ModuloVariaveisDocumento = {
  id: "relatorios_operacional",
  titulo: "Relatórios · Operacional",
  variaveis: [
    { token: "{{total_abertos}}", label: "Operacional: total abertos" },
    { token: "{{total_concluidos}}", label: "Operacional: total concluídos" },
    { token: "{{total_atrasados}}", label: "Operacional: total atrasados" },
    { token: "{{taxa_conclusao}}", label: "Operacional: taxa de conclusão" },
    { token: "{{ticket_medio_horas}}", label: "Operacional: tempo médio ticket (h)" },
    { token: "{{sla}}", label: "Operacional: SLA (%)" },
    { token: "{{tabela_resumo_tarefas_html}}", label: "Tabela: resumo de tarefas" },
    { token: "{{tabela_resumo_tickets_html}}", label: "Tabela: resumo de tickets" },
  ],
};

const MODULO_RELATORIOS_FINANCEIRO: ModuloVariaveisDocumento = {
  id: "relatorios_financeiro",
  titulo: "Relatórios · Financeiro",
  variaveis: [
    { token: "{{receita_mes}}", label: "Financeiro: receita do mês" },
    { token: "{{despesa_mes}}", label: "Financeiro: despesa do mês" },
    { token: "{{saldo_mes}}", label: "Financeiro: saldo do mês" },
    { token: "{{previsto_mes}}", label: "Financeiro: previsto do mês" },
    { token: "{{receita_acumulada}}", label: "Financeiro: receita acumulada" },
    { token: "{{despesa_acumulada}}", label: "Financeiro: despesa acumulada" },
    { token: "{{saldo_acumulado}}", label: "Financeiro: saldo acumulado" },
    { token: "{{receber_futuro}}", label: "Financeiro: receber futuro" },
    { token: "{{pagar_futuro}}", label: "Financeiro: pagar futuro" },
    { token: "{{saldo_futuro}}", label: "Financeiro: saldo futuro" },
    { token: "{{inadimplencia}}", label: "Financeiro: inadimplência (%)" },
    { token: "{{tabela_receitas_html}}", label: "Tabela: receitas" },
    { token: "{{tabela_despesas_html}}", label: "Tabela: despesas" },
  ],
};

const MODULO_RELATORIOS_COMERCIAL: ModuloVariaveisDocumento = {
  id: "relatorios_comercial",
  titulo: "Relatórios · Comercial",
  variaveis: [
    { token: "{{leads_mes}}", label: "Comercial: leads no mês" },
    { token: "{{propostas_mes}}", label: "Comercial: propostas no mês" },
    { token: "{{ganhos_mes}}", label: "Comercial: ganhos no mês" },
    { token: "{{taxa_conversao}}", label: "Comercial: taxa de conversão (%)" },
    { token: "{{valor_pipeline}}", label: "Comercial: valor no pipeline" },
    { token: "{{ticket_medio}}", label: "Comercial: ticket médio" },
    { token: "{{tabela_pipeline_html}}", label: "Comercial: tabela pipeline" },
  ],
};

/** Abas na ordem de exibição. */
export const VARIAVEIS_DOCUMENTO_MODULOS: ModuloVariaveisDocumento[] = [
  MODULO_EMPRESA,
  MODULO_CLIENTE,
  MODULO_COMERCIAL,
  MODULO_SOLUCOES,
  MODULO_CONTATO,
  MODULO_FINANCEIRO,
  MODULO_RH,
  MODULO_RELATORIOS_PRESTACAO_CONTAS,
  MODULO_RELATORIOS_OPERACIONAL,
  MODULO_RELATORIOS_FINANCEIRO,
  MODULO_RELATORIOS_COMERCIAL,
  MODULO_USUARIO_DATA,
];

/** Lista plana de tokens (todas as abas). */
export const VARIAVEIS_DOCUMENTO_TODOS: readonly string[] = VARIAVEIS_DOCUMENTO_MODULOS.flatMap((m) =>
  m.variaveis.map((v) => v.token)
);

/** @deprecated use VARIAVEIS_DOCUMENTO_MODULOS / VARIAVEIS_DOCUMENTO_TODOS */
export const VARIAVEIS_DOCUMENTO_COMERCIAL = VARIAVEIS_DOCUMENTO_TODOS;

const TOKEN_REGEX = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function preencherTemplateDocumento(texto: string, valores: Record<string, string>): string {
  if (!texto) return texto;
  return texto.replace(TOKEN_REGEX, (full, inner: string) => {
    const canonical = `{{${inner.trim()}}}`;
    if (Object.prototype.hasOwnProperty.call(valores, canonical)) {
      const v = valores[canonical];
      return v !== undefined && v !== null ? String(v) : full;
    }
    return full;
  });
}

/** Valores fictícios para preview na configuração (todos os tokens conhecidos). */
export function valoresPreviewExemplo(ref: Date = new Date(), empresa?: { razaoSocial?: string; nomeFantasia?: string; cnpj?: string; telefone?: string; email?: string; site?: string; endereco?: string; }): Record<string, string> {
  const h = ref.getHours().toString().padStart(2, "0");
  const min = ref.getMinutes().toString().padStart(2, "0");
  return {
    "{{empresa.razaoSocial}}": "PAM Gestão Ltda",
    "{{empresa.nomeFantasia}}": empresa?.nomeFantasia?.trim() || "Plataforma PAM",
    "{{empresa.cnpj}}": empresa?.cnpj?.trim() || "00.000.000/0001-00",
    "{{empresa.telefone}}": empresa?.telefone?.trim() || "(11) 3000-0000",
    "{{empresa.email}}": empresa?.email?.trim() || "contato@empresa.com.br",
    "{{empresa.site}}": empresa?.site?.trim() || "https://www.empresa.com.br",
    "{{empresa.endereco}}": "Av. Paulista, 1000 — São Paulo/SP",
    "{{cliente.nome}}": "Empresa Exemplo LTDA",
    "{{cliente.cpfCnpj}}": "12.345.678/0001-90",
    "{{cliente.email}}": "compras@exemplo.com.br",
    "{{cliente.telefone}}": "(11) 98888-7777",
    "{{cliente.segmento}}": "Serviços",
    "{{cliente.municipioUf}}": "Campinas/SP",
    "{{lead.titulo}}": "Implantação de Sistema de Gestão",
    "{{lead.descricao}}": "Projeto completo com suporte e treinamento.",
    "{{lead.valorTotal}}": "R$ 18.900,00",
    "{{lead.condicoesPagamento}}": "30% entrada + 70% em 3 parcelas",
    "{{lead.prazoValidade}}": "30 dias",
    "{{lead.origem}}": "Indicação",
    "{{lead.etapa}}": "Proposta",
    "{{lead.prioridade}}": "Alta",
    "{{lead.previsaoFechamento}}": "15/05/2026",
    "{{lead.contatoPrincipal}}": "Maria Silva",
    "{{lead.email}}": "maria@exemplo.com.br",
    "{{lead.telefone}}": "(19) 97777-6666",
    "{{lead.empresa}}": "Empresa Exemplo LTDA",
    "{{lead.municipioUf}}": "Campinas/SP",
    "{{solucoes.lista}}": "ERP Corporativo, Treinamento e Suporte",
    "{{solucoes.total}}": "R$ 18.900,00",
    "{{solucoes.detalhamento}}": "ERP — R$ 15.000\nTreinamento — R$ 3.900",
    "{{contato.gestorPrincipal.nome}}": "Maria Silva",
    "{{contato.gestorPrincipal.email}}": "maria@exemplo.com.br",
    "{{contato.gestorContrato.nome}}": "João Souza",
    "{{contato.gestorFinanceiro.nome}}": "Ana Costa",
    "{{contato.tecnico.nome}}": "Carlos Tech",
    "{{usuario.nome}}": "Equipe Comercial",
    "{{usuario.email}}": "comercial@empresa.com.br",
    "{{data.hoje}}": ref.toLocaleDateString("pt-BR"),
    "{{data.hora}}": `${h}:${min}`,
    "{{data.ano}}": String(ref.getFullYear()),
    "{{financeiro.formaPagamento}}": "Boleto + PIX",
    "{{financeiro.observacoes}}": "Conforme condições acordadas na proposta.",
    "{{rh.colaborador.nome}}": "Fornecedor Exemplo S/A",
    "{{rh.colaborador.cargo}}": "Parceiro integrador",
    "{{rh.colaborador.email}}": "parcerias@fornecedor.com.br",
    "{{cliente_nome}}": "Empresa Exemplo LTDA",
    "{{periodo_inicio}}": "01/04/2026",
    "{{periodo_fim}}": "30/04/2026",
    "{{resumo_total_tarefas}}": "24",
    "{{resumo_total_tickets}}": "11",
    "{{resumo_tarefas_atrasadas}}": "3",
    "{{resumo_tickets_atrasados}}": "2",
    "{{tabela_tarefas_html}}": "<p>(preview) tabela de tarefas</p>",
    "{{tabela_tickets_html}}": "<p>(preview) tabela de tickets</p>",
    "{{tabela_tarefas_detalhada_html}}": "<p>(preview) tabela detalhada de tarefas</p>",
    "{{tabela_tickets_detalhada_html}}": "<p>(preview) tabela detalhada de tickets</p>",
    "{{total_abertos}}": "18",
    "{{total_concluidos}}": "32",
    "{{total_atrasados}}": "4",
    "{{taxa_conclusao}}": "64%",
    "{{ticket_medio_horas}}": "11,4",
    "{{sla}}": "86%",
    "{{tabela_resumo_tarefas_html}}": "<p>(preview) resumo tarefas</p>",
    "{{tabela_resumo_tickets_html}}": "<p>(preview) resumo tickets</p>",
    "{{receita_mes}}": "R$ 120.000,00",
    "{{despesa_mes}}": "R$ 82.500,00",
    "{{saldo_mes}}": "R$ 37.500,00",
    "{{previsto_mes}}": "R$ 40.200,00",
    "{{receita_acumulada}}": "R$ 480.000,00",
    "{{despesa_acumulada}}": "R$ 327.000,00",
    "{{saldo_acumulado}}": "R$ 153.000,00",
    "{{receber_futuro}}": "R$ 19.500,00",
    "{{pagar_futuro}}": "R$ 12.300,00",
    "{{saldo_futuro}}": "R$ 7.200,00",
    "{{inadimplencia}}": "6,4%",
    "{{tabela_receitas_html}}": "<p>(preview) tabela de receitas</p>",
    "{{tabela_despesas_html}}": "<p>(preview) tabela de despesas</p>",
    "{{leads_mes}}": "42",
    "{{propostas_mes}}": "17",
    "{{ganhos_mes}}": "9",
    "{{taxa_conversao}}": "52,9%",
    "{{valor_pipeline}}": "R$ 310.000,00",
    "{{ticket_medio}}": "R$ 13.900,00",
    "{{tabela_pipeline_html}}": "<p>(preview) tabela de pipeline</p>",
  };
}

