import type { SessionPayload } from "@/lib/auth";
import type { PermissionAction } from "@/lib/configuracoes/permission-catalog";
import { authorize } from "@/lib/server/authorize";
import { isPrivilegedSession } from "@/lib/server/session-access";
import { resourceAccessGate, type ResourceAccessGate } from "@/lib/server/rbac-gate";

export const ALERTAS_CAIXA_RESOURCE = "alertas.caixa";

const FINANCEIRO_VER_RESOURCES = [
  "financeiro.lancamentos",
  "financeiro.comissoes",
  "financeiro.extrato",
  "financeiro.aprovacoes",
  "financeiro.venda_direta",
] as const;

/** Módulo do alerta → recurso granular com ação Ver (ou qualquer sub-recurso financeiro). */
const MODULE_TO_RESOURCE: Record<string, string | "financeiro_any" | null> = {
  sistema: null,
  comercial: "comercial.pipeline",
  financeiro: "financeiro_any",
  clientes: "clientes.cadastro",
  contratos: "contratos.lista",
  helpdesk: "helpdesk.tickets",
  posVenda: "posvenda.tarefas",
  tarefas: "tarefas.internas",
};

function hasAnyFinanceiroVer(session: SessionPayload): boolean {
  return FINANCEIRO_VER_RESOURCES.some((id) => authorize(session, id, "ver").allowed);
}

function canViewAlertModule(session: SessionPayload, modulo: string): boolean {
  const resourceId = MODULE_TO_RESOURCE[modulo];
  if (resourceId === undefined) return false;
  if (resourceId === null) return true;
  if (resourceId === "financeiro_any") return hasAnyFinanceiroVer(session);
  return authorize(session, resourceId, "ver").allowed;
}

/** Módulos de alerta visíveis para o perfil (exige Ver em `alertas.caixa` + Ver no módulo de origem). */
export function allowedAlertModules(session: SessionPayload | null): Set<string> {
  if (!session?.perfilId) return new Set();
  if (isPrivilegedSession(session)) return new Set(Object.keys(MODULE_TO_RESOURCE));
  if (!authorize(session, ALERTAS_CAIXA_RESOURCE, "ver").allowed) return new Set();

  const allowed = new Set<string>();
  for (const modulo of Object.keys(MODULE_TO_RESOURCE)) {
    if (canViewAlertModule(session, modulo)) allowed.add(modulo);
  }
  return allowed;
}

export function alertaUsuarioScope(session: SessionPayload) {
  const userId = session.userId?.trim();
  if (userId) {
    return { OR: [{ usuarioId: null }, { usuarioId: userId }] };
  }
  return { usuarioId: null as string | null };
}

export async function alertasAccessGate(
  req: Request,
  action: PermissionAction
): Promise<ResourceAccessGate> {
  return resourceAccessGate(
    req,
    ALERTAS_CAIXA_RESOURCE,
    action,
    "Sem permissão para a caixa de alertas."
  );
}
