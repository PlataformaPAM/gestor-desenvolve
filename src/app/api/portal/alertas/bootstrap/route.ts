import type { Alerta } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/server/api-response";
import { resolvePortalContext } from "@/lib/server/portal-access";

function cleanUserDescription(value: string): string {
  return value.replace(/\s*\[ALERTA_DEDUPE:[^\]]+\]/gi, "").trim();
}

function inferPrioridade(texto: string): "urgente" | "alta" | "normal" {
  if (/atrasad|venc(e|ido).*hoje|inadimplente|falha|diverg[eê]ncia|risco|impedimento|urgente/i.test(texto)) {
    return "urgente";
  }
  if (/amanh|venc(e|er)|7 dias|30 dias|15 dias|60 dias|pendente/i.test(texto)) {
    return "alta";
  }
  return "normal";
}

function inferSlaLabel(texto: string): string | null {
  if (/vence hoje/i.test(texto)) return "Vence hoje";
  if (/amanh|vence amanhã/i.test(texto)) return "Vence amanhã";
  if (/7 dias/i.test(texto)) return "Vence em 7 dias";
  if (/3 dias em atraso|\+?3 dias/i.test(texto)) return "+3 dias em atraso";
  if (/7 dias em atraso|\+?7 dias/i.test(texto)) return "+7 dias em atraso";
  if (/15 dias em atraso|\+?15 dias/i.test(texto)) return "+15 dias em atraso";
  if (/30 dias em atraso|\+?30 dias/i.test(texto)) return "+30 dias em atraso";
  if (/60 dias em atraso|\+?60 dias/i.test(texto)) return "+60 dias em atraso";
  if (/atrasad|vencid/i.test(texto)) return "Em atraso";
  return null;
}

export async function GET(req: Request) {
  const ctx = await resolvePortalContext(req);
  if (!ctx) return fail("FORBIDDEN", "Acesso ao portal do cliente não autorizado.", 403);

  const [rows, ticketsCliente] = await Promise.all([
    prisma.alerta.findMany({
      where: {
        OR: [{ usuarioId: null }, { usuarioId: ctx.userId }],
        modulo: { in: ["helpdesk", "sistema"] },
      },
      orderBy: { data: "desc" },
      take: 200,
    }),
    prisma.helpdeskTicket.findMany({
      where: { clienteId: { in: ctx.clienteIds } },
      select: { id: true, codigo: true },
      take: 400,
    }),
  ]);

  const ticketCodigos = ticketsCliente.map((t) => t.codigo).filter(Boolean);
  const ticketIds = ticketsCliente.map((t) => t.id);

  const filtrados = rows.filter((a) => {
    if (a.modulo !== "helpdesk") return true;
    const texto = `${a.titulo} ${a.descricao}`.toLowerCase();
    if (ticketCodigos.some((codigo) => texto.includes(codigo.toLowerCase()))) return true;
    return ticketIds.some((id) => texto.includes(id.toLowerCase()));
  });

  const mapped = filtrados.map((a: Alerta) => {
    const descricaoLimpa = cleanUserDescription(a.descricao);
    const texto = `${a.titulo} ${descricaoLimpa}`;
    return {
      id: a.id,
      modulo: a.modulo,
      titulo: a.titulo,
      descricao: descricaoLimpa,
      data: a.data.toISOString(),
      lida: a.lida,
      prioridade: inferPrioridade(texto),
      slaLabel: inferSlaLabel(texto),
    };
  });

  return ok({ alertas: mapped, data: { alertas: mapped } });
}
