import type { LogSistema, PerfilAcesso, PerfilPermissao, Usuario, UsuarioVinculo } from "@prisma/client";
import type {
  LogSistema as LogSistemaFront,
  ModuloPermissao,
  PerfilAcesso as PerfilAcessoFront,
  UsuarioSistema,
  VinculacaoPessoa,
} from "@/lib/configuracoes/types";
import { DB_PERMISSION_MODULES, withDerivedConfiguracoes } from "@/lib/configuracoes/permission-utils";
import { loadGrantsForPerfil, attachGrantsToPerfilFront } from "@/lib/server/perfil-grants";

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

export function mapPerfil(
  p: PerfilAcesso & { permissoes: PerfilPermissao[]; permissoesGranulares?: unknown },
  extras?: Partial<Record<ModuloPermissao, boolean>>
): PerfilAcessoFront {
  const permissoesBase = Object.fromEntries(
    DB_PERMISSION_MODULES.map((m) => [m, false])
  ) as Partial<Record<ModuloPermissao, boolean>>;
  for (const pp of p.permissoes) {
    const modulo = pp.modulo as ModuloPermissao;
    permissoesBase[modulo] = pp.permitido;
  }
  const permissoes = withDerivedConfiguracoes({ ...permissoesBase, ...(extras ?? {}) });
  const grants = loadGrantsForPerfil(
    {
      nome: p.nome,
      permissoesGranulares: p.permissoesGranulares,
      permissoes: p.permissoes.map((pp) => ({ modulo: pp.modulo, permitido: pp.permitido })),
    },
    extras
  );
  return attachGrantsToPerfilFront(
    {
      id: p.id,
      nome: p.nome,
      descricao: p.descricao ?? undefined,
      permissoes,
    },
    grants
  );
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

