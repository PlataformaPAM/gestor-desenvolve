import type { ModuloPermissao } from "@/lib/configuracoes/types";
import {
  PERMISSION_RESOURCES,
  type GrantsMap,
  type RecursoGrant,
} from "@/lib/configuracoes/permission-catalog";

export type { GrantsMap, RecursoGrant } from "@/lib/configuracoes/permission-catalog";
import { buildDefaultPermissoes, EXTRA_PERMISSION_KEYS } from "@/lib/configuracoes/permission-utils";

export const EMPTY_GRANT: RecursoGrant = {
  ver: false,
  criar: false,
  editar: false,
  excluir: false,
  verTodos: false,
};

export function buildEmptyGrantsMap(): GrantsMap {
  return Object.fromEntries(PERMISSION_RESOURCES.map((r) => [r.id, { ...EMPTY_GRANT }]));
}

function normalizeGrant(raw: unknown): RecursoGrant {
  if (!raw || typeof raw !== "object") return { ...EMPTY_GRANT };
  const o = raw as Record<string, unknown>;
  return {
    ver: o.ver === true,
    criar: o.criar === true,
    editar: o.editar === true,
    excluir: o.excluir === true,
    verTodos: o.verTodos === true,
  };
}

/** Mescla JSON salvo com catálogo atual (novos recursos entram desligados). */
export function parseGrantsMap(raw: unknown): GrantsMap {
  const base = buildEmptyGrantsMap();
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  for (const r of PERMISSION_RESOURCES) {
    if (obj[r.id] !== undefined) {
      base[r.id] = normalizeGrant(obj[r.id]);
    }
  }
  return base;
}

/** Converte toggles legados (módulo on/off) em matriz inicial — módulo ligado = ver + verTodos. */
export function grantsFromLegacyPermissoes(
  permissoes: Partial<Record<ModuloPermissao, boolean>>
): GrantsMap {
  const grants = buildEmptyGrantsMap();
  for (const r of PERMISSION_RESOURCES) {
    const legadoKey = r.extraModuloKey ?? r.moduloLegado;
    if (!legadoKey) continue;
    if (permissoes[legadoKey] === true) {
      grants[r.id] = {
        ver: true,
        criar: true,
        editar: true,
        excluir: !r.bloquearExcluir,
        verTodos: !r.bloquearVerTodos,
      };
    }
  }
  return grants;
}

/** Deriva toggles da sidebar a partir da matriz (qualquer ver na linha liga o módulo). */
export function deriveLegacyPermissoesFromGrants(grants: GrantsMap): Record<ModuloPermissao, boolean> {
  const out = buildDefaultPermissoes();
  for (const r of PERMISSION_RESOURCES) {
    const g = grants[r.id];
    if (!g?.ver) continue;
    if (r.moduloLegado) out[r.moduloLegado] = true;
    if (r.extraModuloKey) out[r.extraModuloKey] = true;
  }
  if (
    out.configuracoes_construtor_documentos ||
    out.configuracoes_logs ||
    out.configuracoes_perfis ||
    out.configuracoes_usuarios
  ) {
    out.configuracoes = true;
  }
  for (const key of EXTRA_PERMISSION_KEYS) {
    if (!(key in out)) continue;
  }
  return out;
}

/** Administrador: todas as ações em todos os recursos (sem exceção de catálogo). */
export function grantsForAdmin(): GrantsMap {
  const grants = buildEmptyGrantsMap();
  for (const r of PERMISSION_RESOURCES) {
    grants[r.id] = {
      ver: true,
      criar: true,
      editar: true,
      excluir: true,
      verTodos: true,
    };
  }
  return grants;
}
