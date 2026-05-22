import type { NextResponse } from "next/server";
import type { SessionPayload } from "@/lib/auth";
import type { PermissionAction } from "@/lib/configuracoes/permission-catalog";
import type { Ticket } from "@/lib/suporte/types";
import { authorize, type DataScope } from "@/lib/server/authorize";
import { fail } from "@/lib/server/api-response";
import { prisma } from "@/lib/prisma";
import { resourceAccessGate, type ResourceAccessGate } from "@/lib/server/rbac-gate";

export const HELPDESK_TICKETS_RESOURCE = "helpdesk.tickets";

/** Referência de usuário vinculado ao ticket (principal ou colaborador — mesma tabela no banco). */
export type HelpdeskTicketVinculoRef = { usuarioId?: string; id?: string };

/** Ticket visível se o usuário é responsável principal ou colaborador (todos em `responsaveis`). */
export function isHelpdeskUsuarioVinculadoAoTicket(
  responsaveis: HelpdeskTicketVinculoRef[],
  userId: string | null | undefined
): boolean {
  if (!userId || responsaveis.length === 0) return false;
  return responsaveis.some((r) => (r.usuarioId ?? r.id) === userId);
}

export function filterHelpdeskTicketsForScope<
  T extends { responsaveis: Array<{ usuarioId: string }> },
>(rows: T[], userId: string | null, scope: DataScope): T[] {
  if (scope === "todos") return rows;
  if (!userId) return [];
  return rows.filter((t) => isHelpdeskUsuarioVinculadoAoTicket(t.responsaveis, userId));
}

export function isTicketVisibleToUser(ticket: Ticket, userId: string | null | undefined): boolean {
  return isHelpdeskUsuarioVinculadoAoTicket(ticket.responsaveis ?? [], userId);
}

export function filterTicketsForSession(
  tickets: Ticket[],
  session: SessionPayload,
  userId: string | null | undefined
): Ticket[] {
  const view = authorize(session, HELPDESK_TICKETS_RESOURCE, "ver");
  if (!view.allowed) return [];
  if (view.scope === "todos") return tickets;
  return tickets.filter((t) => isTicketVisibleToUser(t, userId));
}

async function userCanAccessTicketCodigo(
  userId: string | null,
  ticketCodigo: string,
  scope: "todos" | "vinculados"
): Promise<boolean> {
  if (scope === "todos") return true;
  if (!userId) return false;
  const row = await prisma.helpdeskTicket.findUnique({
    where: { codigo: ticketCodigo },
    select: { responsaveis: { select: { usuarioId: true } } },
  });
  if (!row) return false;
  return isHelpdeskUsuarioVinculadoAoTicket(row.responsaveis, userId);
}

export async function helpdeskAccessGate(
  req: Request,
  action: PermissionAction,
  ticketCodigo?: string
): Promise<ResourceAccessGate> {
  const gate = await resourceAccessGate(
    req,
    HELPDESK_TICKETS_RESOURCE,
    action,
    "Sem permissão para esta ação em Suporte."
  );
  if (!gate.ok) return gate;

  if (ticketCodigo && gate.scope === "vinculados") {
    const row = await prisma.helpdeskTicket.findUnique({
      where: { codigo: ticketCodigo },
      select: { id: true },
    });
    if (!row) {
      return { ok: false, response: fail("NOT_FOUND", "Ticket não encontrado.", 404) };
    }
    const ok = await userCanAccessTicketCodigo(gate.userId, ticketCodigo, gate.scope);
    if (!ok) {
      return {
        ok: false,
        response: fail("FORBIDDEN", "Você não tem acesso a este ticket.", 403),
      };
    }
  }

  return gate;
}
