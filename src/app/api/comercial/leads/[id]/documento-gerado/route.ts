import { prisma } from "@/lib/prisma";
import { mapLeadFromDb } from "@/app/api/comercial/_shared";
import { montarVariaveisDocumentoParaLead, type ClienteVariaveisCtx } from "@/lib/documentos/montar-variaveis-lead";
import { preencherTemplateDocumento } from "@/lib/documentos/template-vars";
import { getEmpresaDocumentoConfig } from "@/lib/documentos/empresa-config";
import { getDocumentoTimbresConfig } from "@/lib/documentos/timbres-config";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { getSessionUserId } from "@/lib/server/request-session";

async function loadLeadComCliente(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      cliente: { include: { endereco: true } },
      solucoes: { include: { solucaoCatalogo: true } },
      contatos: { include: { papeis: true } },
      checklistItems: true,
      contratoChecklist: true,
      contratoArquivos: true,
      financeiroFluxo: true,
      interactions: { include: { user: true, anexos: true }, orderBy: { date: "asc" } },
      criadoPor: { select: { nomeExibicao: true } },
      atualizadoPor: { select: { nomeExibicao: true } },
    },
  });
}

function clienteDbParaCtx(
  c: NonNullable<Awaited<ReturnType<typeof loadLeadComCliente>>>["cliente"]
): ClienteVariaveisCtx | null {
  if (!c) return null;
  const end = c.endereco;
  const munUf = end ? `${end.cidade}/${end.uf}` : "";
  const segmentLabels: Record<string, string> = {
    varejo: "Varejo",
    industria: "Indústria",
    servicos: "Serviços",
    tecnologia: "Tecnologia",
    outros: "Outros",
  };
  return {
    nomeExibicao: (c.empresa?.trim() || c.nome).trim(),
    cpfCnpj: c.cpfCnpj,
    email: c.email,
    telefone: c.telefone,
    segmento: segmentLabels[c.segmento] ?? c.segmento,
    municipioUf: munUf,
  };
}

type PostBody = { modeloId?: string };

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: leadId } = await ctx.params;
  const parsed = await parseJsonSafe<PostBody>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const modeloId = parsed.value.modeloId?.trim();
  if (!modeloId) return fail("BAD_REQUEST", "Informe o modeloId do documento.", 400);

  const row = await loadLeadComCliente(leadId);
  if (!row) return fail("NOT_FOUND", "Lead não encontrado.", 404);

  const modelo = await prisma.documentoModelo.findFirst({
    where: { id: modeloId, ativo: true },
  });
  if (!modelo) return fail("NOT_FOUND", "Modelo não encontrado ou inativo.", 404);

  const sessionUserId = getSessionUserId(req);
  const usuarioRow = sessionUserId
    ? await prisma.usuario.findUnique({
        where: { id: sessionUserId },
        select: { nomeExibicao: true, email: true },
      })
    : null;

  const lead = mapLeadFromDb(row);
  const clienteCtx = clienteDbParaCtx(row.cliente);
  const empresaConfig = await getEmpresaDocumentoConfig();
  const timbresConfig = await getDocumentoTimbresConfig();
  const timbreId = timbresConfig.modeloTimbreById[modelo.id] ?? "";
  const timbre = timbresConfig.items.find((x) => x.id === timbreId);
  const timbreUrl = timbre?.url ?? "";
  const valores = montarVariaveisDocumentoParaLead({
    lead,
    cliente: clienteCtx,
    usuario: usuarioRow
      ? {
          nome: usuarioRow.nomeExibicao?.trim() ?? "",
          email: usuarioRow.email?.trim() ?? "",
        }
      : null,
    empresa: empresaConfig,
    refDate: new Date(),
  });

  const preview = {
    assunto: preencherTemplateDocumento(modelo.assunto ?? "", valores),
    cabecalhoHtml: preencherTemplateDocumento(modelo.cabecalhoHtml ?? "", valores),
    corpoHtml: preencherTemplateDocumento(modelo.corpo ?? "", valores),
    rodapeHtml: preencherTemplateDocumento(modelo.rodapeHtml ?? "", valores),
    timbreUrl,
    renderConfig: timbre?.renderConfig ?? null,
  };

  const now = new Date();
  const interaction = await prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: leadId },
      data: {
        propostaGeradaEm: now,
        ...(sessionUserId ? { atualizadoPorId: sessionUserId } : {}),
      },
    });
    return tx.leadInteraction.create({
      data: {
        leadId,
        date: now,
        type: "proposta",
        action: "CREATE",
        description: `Documento gerado pelo modelo "${modelo.nome}" (v${modelo.versao}).`,
        userId: sessionUserId ?? null,
        autorNome: usuarioRow?.nomeExibicao?.trim() || "Usuário",
        field: "documentoModelo",
        fieldKey: modelo.id,
        newValue: {
          modelo: {
            id: modelo.id,
            nome: modelo.nome,
            tipo: modelo.tipo,
            versao: modelo.versao,
          },
          documento: preview,
        },
      },
      select: { id: true, date: true },
    });
  });

  return ok({
    preview,
    modelo: { id: modelo.id, nome: modelo.nome, tipo: modelo.tipo, versao: modelo.versao },
    interaction: { id: interaction.id, date: interaction.date.toISOString() },
  });
}
