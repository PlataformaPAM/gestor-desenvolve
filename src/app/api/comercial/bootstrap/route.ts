import { prisma } from "@/lib/prisma";
import { mapClienteFromDb } from "../_shared";
import { fail, ok } from "@/lib/server/api-response";
import { authorize } from "@/lib/server/authorize";
import {
  comercialAccessGate,
  COMERCIAL_PIPELINE_RESOURCE,
  filterLeadsForSession,
} from "@/lib/server/comercial-lead-access";
import {
  leadIdsExplicitlyLinkedToUser,
  loadComercialBootstrapLeadsRaw,
  mapComercialBootstrapLeads,
} from "@/lib/server/comercial-bootstrap-leads";

export async function GET(req: Request) {
  const gate = await comercialAccessGate(req, "ver");
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";

  try {
    const [clientesRaw, leadsRaw] = await Promise.all([
      prisma.cliente.findMany({
        include: {
          endereco: true,
          contatos: { include: { papeis: true } },
          propostas: true,
          faturas: true,
          ticketsResumo: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      loadComercialBootstrapLeadsRaw(),
    ]);

    const mappedClientes = clientesRaw.map(mapClienteFromDb);
    const allLeads = mapComercialBootstrapLeads(leadsRaw);
    const view = authorize(gate.session, COMERCIAL_PIPELINE_RESOURCE, "ver");

    const linkedIds =
      view.scope === "vinculados"
        ? await leadIdsExplicitlyLinkedToUser(gate.userId, gate.session.userName)
        : new Set<string>();

    const mappedLeads = filterLeadsForSession(allLeads, gate.session, gate.userId, linkedIds);

    const payload: {
      clientes: typeof mappedClientes;
      leads: typeof mappedLeads;
      data: { clientes: typeof mappedClientes; leads: typeof mappedLeads };
      meta?: Record<string, unknown>;
    } = {
      clientes: mappedClientes,
      leads: mappedLeads,
      data: { clientes: mappedClientes, leads: mappedLeads },
    };

    if (debug || (view.scope === "vinculados" && allLeads.length > mappedLeads.length)) {
      const hidden = allLeads.filter((l) => !mappedLeads.some((v) => v.id === l.id));
      payload.meta = {
        scope: view.scope,
        userId: gate.userId,
        userName: gate.session.userName ?? null,
        totalDb: allLeads.length,
        totalVisible: mappedLeads.length,
        totalHidden: hidden.length,
        linkedByInteractionOrCreator: linkedIds.size,
        hiddenSample: hidden.slice(0, 5).map((l) => ({
          id: l.id,
          name: l.name,
          registroLead: l.registroLead,
          criadoPorId: l.criadoPorId,
          registroCriadoPorNome: l.registroCriadoPorNome,
        })),
      };
      if (view.scope === "vinculados" && hidden.length > 0) {
        console.warn("[comercial/bootstrap] leads ocultos pelo escopo vinculados", payload.meta);
      }
    }

    return ok(payload);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[comercial/bootstrap GET]", err);
    return fail(
      "INTERNAL_ERROR",
      debug
        ? `Falha ao carregar bootstrap comercial. Detalhe: ${detail}`
        : `Falha ao carregar bootstrap comercial. Detalhe: ${detail}`,
      500
    );
  }
}
