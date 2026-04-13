/**
 * VariÃ¡veis dos modelos do Construtor de Documentos.
 * Formato: {{grupo.campo}} (espaÃ§os opcionais dentro das chaves).
 * Etapas futuras preenchem tokens com dados reais (lead, cliente, etc.).
 */

export type VariavelDocumentoDef = {
  token: string;
  /** RÃ³tulo curto na UI */
  label: string;
};

export type ModuloVariaveisDocumento = {
  id: string;
  titulo: string;
  variaveis: VariavelDocumentoDef[];
};

/** OrganizaÃ§Ã£o / dados fixos (cabeÃ§alho, rodapÃ©, contrato da empresa). */
const MODULO_EMPRESA: ModuloVariaveisDocumento = {
  id: "empresa",
  titulo: "Empresa",
  variaveis: [
    { token: "{{empresa.razaoSocial}}", label: "RazÃ£o social" },
    { token: "{{empresa.nomeFantasia}}", label: "Nome fantasia" },
    { token: "{{empresa.cnpj}}", label: "CNPJ" },
    { token: "{{empresa.telefone}}", label: "Telefone" },
    { token: "{{empresa.email}}", label: "E-mail" },
    { token: "{{empresa.site}}", label: "Site" },
    { token: "{{empresa.endereco}}", label: "EndereÃ§o completo" },
  ],
};

const MODULO_CLIENTE: ModuloVariaveisDocumento = {
  id: "cliente",
  titulo: "Cliente",
  variaveis: [
    { token: "{{cliente.nome}}", label: "Nome / razÃ£o social" },
    { token: "{{cliente.cpfCnpj}}", label: "CPF/CNPJ" },
    { token: "{{cliente.email}}", label: "E-mail" },
    { token: "{{cliente.telefone}}", label: "Telefone" },
    { token: "{{cliente.segmento}}", label: "Segmento" },
    { token: "{{cliente.municipioUf}}", label: "MunicÃ­pio/UF" },
  ],
};

const MODULO_COMERCIAL: ModuloVariaveisDocumento = {
  id: "comercial",
  titulo: "Comercial (lead)",
  variaveis: [
    { token: "{{lead.titulo}}", label: "TÃ­tulo da oportunidade" },
    { token: "{{lead.descricao}}", label: "DescriÃ§Ã£o" },
    { token: "{{lead.valorTotal}}", label: "Valor total" },
    { token: "{{lead.condicoesPagamento}}", label: "CondiÃ§Ãµes de pagamento" },
    { token: "{{lead.prazoValidade}}", label: "Prazo de validade" },
    { token: "{{lead.origem}}", label: "Origem" },
    { token: "{{lead.etapa}}", label: "Etapa do funil" },
    { token: "{{lead.prioridade}}", label: "Prioridade" },
    { token: "{{lead.previsaoFechamento}}", label: "PrevisÃ£o de fechamento" },
    { token: "{{lead.contatoPrincipal}}", label: "Contato principal" },
    { token: "{{lead.email}}", label: "E-mail (lead)" },
    { token: "{{lead.telefone}}", label: "Telefone (lead)" },
    { token: "{{lead.empresa}}", label: "Empresa (nome)" },
    { token: "{{lead.municipioUf}}", label: "MunicÃ­pio/UF (lead)" },
  ],
};

const MODULO_SOLUCOES: ModuloVariaveisDocumento = {
  id: "solucoes",
  titulo: "SoluÃ§Ãµes",
  variaveis: [
    { token: "{{solucoes.lista}}", label: "Lista de soluÃ§Ãµes" },
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
    { token: "{{contato.tecnico.nome}}", label: "TÃ©cnico â€” nome" },
  ],
};

const MODULO_USUARIO_DATA: ModuloVariaveisDocumento = {
  id: "usuario_data",
  titulo: "UsuÃ¡rio e data",
  variaveis: [
    { token: "{{usuario.nome}}", label: "Nome do usuÃ¡rio logado" },
    { token: "{{usuario.email}}", label: "E-mail do usuÃ¡rio" },
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
    { token: "{{financeiro.observacoes}}", label: "ObservaÃ§Ãµes financeiras" },
  ],
};

const MODULO_RH: ModuloVariaveisDocumento = {
  id: "rh",
  titulo: "RH / Fornecedor",
  variaveis: [
    { token: "{{rh.colaborador.nome}}", label: "Nome (colaborador/fornecedor)" },
    { token: "{{rh.colaborador.cargo}}", label: "Cargo/funÃ§Ã£o" },
    { token: "{{rh.colaborador.email}}", label: "E-mail" },
  ],
};

/** Abas na ordem de exibiÃ§Ã£o. */
export const VARIAVEIS_DOCUMENTO_MODULOS: ModuloVariaveisDocumento[] = [
  MODULO_EMPRESA,
  MODULO_CLIENTE,
  MODULO_COMERCIAL,
  MODULO_SOLUCOES,
  MODULO_CONTATO,
  MODULO_FINANCEIRO,
  MODULO_RH,
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

/** Valores fictÃ­cios para preview na configuraÃ§Ã£o (todos os tokens conhecidos). */
export function valoresPreviewExemplo(ref: Date = new Date(), empresa?: { razaoSocial?: string; nomeFantasia?: string; cnpj?: string; telefone?: string; email?: string; site?: string; endereco?: string; }): Record<string, string> {
  const h = ref.getHours().toString().padStart(2, "0");
  const min = ref.getMinutes().toString().padStart(2, "0");
  return {
    "{{empresa.razaoSocial}}": "PAM GestÃ£o Ltda",
    "{{empresa.nomeFantasia}}": empresa?.nomeFantasia?.trim() || "Plataforma PAM",
    "{{empresa.cnpj}}": empresa?.cnpj?.trim() || "00.000.000/0001-00",
    "{{empresa.telefone}}": empresa?.telefone?.trim() || "(11) 3000-0000",
    "{{empresa.email}}": empresa?.email?.trim() || "contato@empresa.com.br",
    "{{empresa.site}}": empresa?.site?.trim() || "https://www.empresa.com.br",
    "{{empresa.endereco}}": "Av. Paulista, 1000 â€” SÃ£o Paulo/SP",
    "{{cliente.nome}}": "Empresa Exemplo LTDA",
    "{{cliente.cpfCnpj}}": "12.345.678/0001-90",
    "{{cliente.email}}": "compras@exemplo.com.br",
    "{{cliente.telefone}}": "(11) 98888-7777",
    "{{cliente.segmento}}": "ServiÃ§os",
    "{{cliente.municipioUf}}": "Campinas/SP",
    "{{lead.titulo}}": "ImplantaÃ§Ã£o de Sistema de GestÃ£o",
    "{{lead.descricao}}": "Projeto completo com suporte e treinamento.",
    "{{lead.valorTotal}}": "R$ 18.900,00",
    "{{lead.condicoesPagamento}}": "30% entrada + 70% em 3 parcelas",
    "{{lead.prazoValidade}}": "30 dias",
    "{{lead.origem}}": "IndicaÃ§Ã£o",
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
    "{{solucoes.detalhamento}}": "ERP â€” R$ 15.000\nTreinamento â€” R$ 3.900",
    "{{contato.gestorPrincipal.nome}}": "Maria Silva",
    "{{contato.gestorPrincipal.email}}": "maria@exemplo.com.br",
    "{{contato.gestorContrato.nome}}": "JoÃ£o Souza",
    "{{contato.gestorFinanceiro.nome}}": "Ana Costa",
    "{{contato.tecnico.nome}}": "Carlos Tech",
    "{{usuario.nome}}": "Equipe Comercial",
    "{{usuario.email}}": "comercial@empresa.com.br",
    "{{data.hoje}}": ref.toLocaleDateString("pt-BR"),
    "{{data.hora}}": `${h}:${min}`,
    "{{data.ano}}": String(ref.getFullYear()),
    "{{financeiro.formaPagamento}}": "Boleto + PIX",
    "{{financeiro.observacoes}}": "Conforme condiÃ§Ãµes acordadas na proposta.",
    "{{rh.colaborador.nome}}": "Fornecedor Exemplo S/A",
    "{{rh.colaborador.cargo}}": "Parceiro integrador",
    "{{rh.colaborador.email}}": "parcerias@fornecedor.com.br",
  };
}

