import { prisma } from "@/lib/prisma";
import { mapClienteFromDb, mapLeadFromDb } from "../_shared";
import { fail, ok } from "@/lib/server/api-response";

export async function GET() {
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
      prisma.lead.findMany({
        where: { registroLead: "oportunidade" },
        include: {
          criadoPor: { select: { nomeExibicao: true } },
          atualizadoPor: { select: { nomeExibicao: true } },
          solucoes: { include: { solucaoCatalogo: true } },
          contatos: { include: { papeis: true } },
          checklistItems: true,
          contratoChecklist: true,
          contratoArquivos: true,
          financeiroFluxo: true,
          interactions: { include: { user: true, anexos: true }, orderBy: { date: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const mappedClientes = clientesRaw.map(mapClienteFromDb);
    const mappedLeads = leadsRaw.map(mapLeadFromDb);
    return ok({
      clientes: mappedClientes,
      leads: mappedLeads,
      data: { clientes: mappedClientes, leads: mappedLeads },
    });
  } catch {
    return fail("INTERNAL_ERROR", "Falha ao carregar bootstrap comercial.", 500);
  }
}

