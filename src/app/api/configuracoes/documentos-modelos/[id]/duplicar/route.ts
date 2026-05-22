import { prisma } from "@/lib/prisma";
import { documentoModeloToDto } from "@/lib/configuracoes/documentos-modelos";
import { getDocumentoTimbresConfig, saveDocumentoTimbresConfig } from "@/lib/documentos/timbres-config";
import { fail, ok } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { CONFIG_RESOURCES, configuracoesAccessGate } from "@/lib/server/configuracoes-access";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await configuracoesAccessGate(req, CONFIG_RESOURCES.construtorDocumentos, "criar");
  if (!gate.ok) return gate.response;

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
    const cfg = await getDocumentoTimbresConfig();
    const sourceTimbreId = cfg.modeloTimbreById[orig.id];
    if (sourceTimbreId) {
      cfg.modeloTimbreById[created.id] = sourceTimbreId;
      await saveDocumentoTimbresConfig(cfg);
    }
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
