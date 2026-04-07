import type { LogSistema, PerfilAcesso, PerfilPermissao, Usuario, UsuarioVinculo } from "@prisma/client";
import type {
  LogSistema as LogSistemaFront,
  ModuloPermissao,
  PerfilAcesso as PerfilAcessoFront,
  UsuarioSistema,
  VinculacaoPessoa,
} from "@/lib/configuracoes/types";

const ALL_MODULES: ModuloPermissao[] = [
  "comercial",
  "financeiro",
  "tarefas",
  "clientes",
  "helpdesk",
  "posVenda",
  "rh",
  "configuracoes",
];

function mapVinculacaoLegacy(u: Usuario): VinculacaoPessoa | undefined {
  if (!u.vinculacaoTipo || !u.vinculacaoPessoaId) return undefined;
  if (u.vinculacaoTipo === "rh") return { tipo: "rh", id: u.vinculacaoPessoaId };
  if (u.vinculacaoTipo === "cliente") return { tipo: "cliente", id: u.vinculacaoPessoaId };
  return undefined;
}

function mapVinculos(vinculos?: UsuarioVinculo[]) {
  if (!vinculos?.length) return undefined;
  return vinculos.map((v) => ({ tipo: v.tipo, id: v.pessoaId }));
}

export function mapUsuario(u: Usuario & { vinculos?: UsuarioVinculo[] }): UsuarioSistema {
  const vinculos = mapVinculos(u.vinculos);
  return {
    id: u.id,
    cpf: u.cpf,
    email: u.email,
    nomeExibicao: u.nomeExibicao ?? undefined,
    perfilId: u.perfilId,
    ativo: u.ativo,
    vinculacao: vinculos?.[0] ?? mapVinculacaoLegacy(u),
    vinculos,
    criadoEm: u.criadoEm?.toISOString() ?? u.createdAt.toISOString(),
    atualizadoEm: u.atualizadoEmSistema?.toISOString() ?? u.updatedAt.toISOString(),
  };
}

export function mapPerfil(p: PerfilAcesso & { permissoes: PerfilPermissao[] }): PerfilAcessoFront {
  const permissoes = Object.fromEntries(ALL_MODULES.map((m) => [m, false])) as Record<ModuloPermissao, boolean>;
  for (const pp of p.permissoes) {
    const modulo = pp.modulo as ModuloPermissao;
    permissoes[modulo] = pp.permitido;
  }
  return {
    id: p.id,
    nome: p.nome,
    descricao: p.descricao ?? undefined,
    permissoes,
  };
}

export function mapLog(l: LogSistema & { usuario: Usuario | null }): LogSistemaFront {
  return {
    id: l.id,
    data: l.data.toISOString(),
    usuarioCpf: l.usuario?.cpf ?? undefined,
    usuarioNome: l.usuario?.nomeExibicao ?? undefined,
    acao: l.acao,
    modulo: l.modulo ?? undefined,
    detalhes: l.detalhes ?? undefined,
  };
}

