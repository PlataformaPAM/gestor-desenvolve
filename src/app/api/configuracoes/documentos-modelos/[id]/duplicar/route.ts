import { prisma } from "@/lib/prisma";
import { documentoModeloToDto } from "@/lib/configuracoes/documentos-modelos";
import { fail, ok } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const orig = await prisma.documentoModelo.findUnique({ where: { id } });
  if (!orig) return fail("NOT_FOUND", "Modelo não encontrado.", 404);

  const baseNome = `${orig.nome} (cópia)`;
  const nome =
    baseNome.length > 180 ? `${baseNome.slice(0, 177)}...` : baseNome;

  try {
    const created = await prisma.documentoModelo.create({
      data: {
        nome,
        tipo: orig.tipo,
        descricao: orig.descricao,
        assunto: orig.assunto,
        logoUrl: orig.logoUrl,
        cabecalhoHtml: orig.cabecalhoHtml,
        corpo: orig.corpo,
        rodapeHtml: orig.rodapeHtml,
        ativo: true,
        versao: 1,
      },
    });
    await writeAuditLog(prisma, {
      acao: "Modelo de documento duplicado",
      modulo: "configuracoes",
      detalhes: `Origem: ${orig.nome} → ${created.nome}`,
    });
    return ok({ modelo: documentoModeloToDto(created) }, 201);
  } catch {
    return fail("INTERNAL_ERROR", "Não foi possível duplicar o modelo.", 500);
  }
}
