import type { Alerta } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/server/api-response";
import { getSessionFromCookieHeader } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { reconcileStaleModuleAlerts } from "@/lib/server/alerts-resolve";

const MODULE_TO_PERMISSION: Record<string, string | null> = {
  sistema: null,
  comercial: "comercial",
  financeiro: "financeiro",
  clientes: "clientes",
  contratos: "clientes",
  helpdesk: "helpdesk",
  posVenda: "posVenda",
  tarefas: "tarefas",
};

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
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  const allowed = new Set<string>(
    Object.entries(MODULE_TO_PERMISSION)
      .filter(([, permission]) => {
        if (!permission) return true;
        if (!session?.permissoes) return true;
        return session.permissoes[permission as keyof typeof session.permissoes] === true;
      })
      .map(([modulo]) => modulo)
  );

  const whereUsuario = session?.userId
    ? { OR: [{ usuarioId: null }, { usuarioId: session.userId }] }
    : { usuarioId: null as string | null };

  let rows: Alerta[] = [];
  try {
    await reconcileStaleModuleAlerts(prisma).catch(() => undefined);

    rows = await prisma.alerta.findMany({
      where: { ...whereUsuario, modulo: { in: [...allowed] } },
      orderBy: { data: "desc" },
      take: 200,
    });
  } catch (error) {
    // Produção antiga sem tabela Alerta: não derruba página, retorna lista vazia.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021")) {
      throw error;
    }
  }

  const mapped = rows.map((a: Alerta) => {
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

  return ok({
    alertas: mapped,
    data: { alertas: mapped },
  });
}

