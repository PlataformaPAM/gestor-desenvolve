import type { NextResponse } from "next/server";
import type { SessionPayload } from "@/lib/auth";
import type { PermissionAction } from "@/lib/configuracoes/permission-catalog";
import { authorize } from "@/lib/server/authorize";
import { fail } from "@/lib/server/api-response";
import { resourceAccessGate, type ResourceAccessGate } from "@/lib/server/rbac-gate";
import { getRequestSession } from "@/lib/server/request-session";

export const CONFIG_RESOURCES = {
  dadosEmpresa: "configuracoes.dados_empresa",
  papeisTimbrados: "configuracoes.papeis_timbrados",
  construtorDocumentos: "configuracoes.construtor_documentos",
  logs: "configuracoes.logs",
  perfis: "configuracoes.perfis",
  usuarios: "configuracoes.usuarios",
} as const;

export type ConfigResourceId = (typeof CONFIG_RESOURCES)[keyof typeof CONFIG_RESOURCES];

export const ALL_CONFIG_RESOURCE_IDS: ConfigResourceId[] = Object.values(CONFIG_RESOURCES);

export async function configuracoesAccessGate(
  req: Request,
  resourceId: ConfigResourceId,
  action: PermissionAction
): Promise<ResourceAccessGate> {
  return resourceAccessGate(
    req,
    resourceId,
    action,
    "Sem permissão para esta ação em Configurações."
  );
}

export type ConfiguracoesBootstrapGate =
  | {
      ok: true;
      session: SessionPayload;
      canUsuarios: boolean;
      canPerfis: boolean;
      canLogs: boolean;
    }
  | { ok: false; response: NextResponse };

/** Bootstrap: exige Ver em ao menos um recurso de Configurações; filtra dados por sub-recurso. */
export async function configuracoesBootstrapGate(req: Request): Promise<ConfiguracoesBootstrapGate> {
  const session = await getRequestSession(req);
  if (!session?.perfilId) {
    return { ok: false, response: fail("UNAUTHORIZED", "Sessão inválida.", 401) };
  }

  const canUsuarios = authorize(session, CONFIG_RESOURCES.usuarios, "ver").allowed;
  const canPerfis = authorize(session, CONFIG_RESOURCES.perfis, "ver").allowed;
  const canLogs = authorize(session, CONFIG_RESOURCES.logs, "ver").allowed;
  const canAny = ALL_CONFIG_RESOURCE_IDS.some((id) => authorize(session, id, "ver").allowed);

  if (!canAny) {
    return { ok: false, response: fail("FORBIDDEN", "Sem permissão para Configurações.", 403) };
  }

  return { ok: true, session, canUsuarios, canPerfis, canLogs };
}
