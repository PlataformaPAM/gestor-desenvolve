import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/server/api-response";

type DocumentoGeradoItem = {
  id: string;
  date: string;
  modelo: { id: string; nome: string; tipo: string; versao: number | null };
  assunto: string;
};

function parseDocFromInteraction(newValue: unknown): DocumentoGeradoItem["modelo"] & { assunto: string } | null {
  if (!newValue || typeof newValue !== "object") return null;
  const root = newValue as Record<string, unknown>;
  const modelo = (root.modelo ?? null) as Record<string, unknown> | null;
  const documento = (root.documento ?? null) as Record<string, unknown> | null;
  if (!modelo || !documento) return null;
  const id = typeof modelo.id === "string" ? modelo.id : "";
  const nome = typeof modelo.nome === "string" ? modelo.nome : "";
  const tipo = typeof modelo.tipo === "string" ? modelo.tipo : "";
  if (!id || !nome || !tipo) return null;
  const assunto = typeof documento.assunto === "string" ? documento.assunto : "";
  const versao = typeof modelo.versao === "number" ? modelo.versao : null;
  return { id, nome, tipo, versao, assunto };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: leadId } = await ctx.params;
  const rows = await prisma.leadInteraction.findMany({
    where: {
      leadId,
      type: "proposta",
      field: "documentoModelo",
    },
    orderBy: { date: "desc" },
    select: { id: true, date: true, newValue: true },
  });

  const docs: DocumentoGeradoItem[] = [];
  for (const r of rows) {
    const parsed = parseDocFromInteraction(r.newValue);
    if (!parsed) continue;
    docs.push({
      id: r.id,
      date: r.date.toISOString(),
      modelo: {
        id: parsed.id,
        nome: parsed.nome,
        tipo: parsed.tipo,
        versao: parsed.versao,
      },
      assunto: parsed.assunto,
    });
  }

  return ok({ documentos: docs });
}
