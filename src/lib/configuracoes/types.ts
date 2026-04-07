/** Módulos que podem ser permitidos por perfil (e exibidos na sidebar). */
export type ModuloPermissao =
  | "comercial"
  | "financeiro"
  | "tarefas"
  | "clientes"
  | "helpdesk"
  | "posVenda"
  | "rh"
  | "configuracoes";

/** Todo usuário é obrigatoriamente identificado por CPF. */
export type UsuarioSistema = {
  id: string;
  cpf: string;
  email: string;
  nomeExibicao?: string;
  perfilId: string;
  ativo: boolean;
  /** Compat legado: primeiro vínculo da lista. */
  vinculacao?: VinculacaoPessoa;
  /** Vínculos com pessoas já cadastradas no RH e/ou em Clientes. */
  vinculos?: VinculacaoPessoaDetalhe[];
  criadoEm?: string; // ISO
  atualizadoEm?: string; // ISO
};

export type VinculacaoPessoa =
  | { tipo: "rh"; id: string }
  | { tipo: "cliente"; id: string };

export type VinculacaoPessoaDetalhe = VinculacaoPessoa & {
  nome?: string;
};

/** Perfil de acesso (role): define quais módulos o usuário enxerga na sidebar. */
export type PerfilAcesso = {
  id: string;
  nome: string;
  descricao?: string;
  /** Chave = ModuloPermissao, valor = se pode acessar. Perfil 'Cliente' é filtrado pelo próprio CPF/CNPJ no portal. */
  permissoes: Record<ModuloPermissao, boolean>;
};

/** Entrada de log do sistema (auditoria). */
export type LogSistema = {
  id: string;
  data: string; // ISO
  usuarioCpf?: string;
  usuarioNome?: string;
  acao: string;
  modulo?: string;
  detalhes?: string;
};

/** Item para busca de vínculo (RH ou Cliente). */
export type PessoaParaVinculo = {
  id: string;
  nome: string;
  cpfCnpj: string;
  tipo: "rh" | "cliente";
  subtitulo?: string; // ex: cargo ou empresa
};
