import { prisma } from "@/lib/prisma";
import { documentoModeloToDto } from "@/lib/configuracoes/documentos-modelos";
import { getDocumentoTimbresConfig, saveDocumentoTimbresConfig } from "@/lib/documentos/timbres-config";
import { htmlTemTextoVisivel } from "@/lib/documentos/html-text";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { CONFIG_RESOURCES, configuracoesAccessGate } from "@/lib/server/configuracoes-access";
import type { DocumentoModeloTipo } from "@prisma/client";

const TIPOS: DocumentoModeloTipo[] = [
  "proposta_comercial",
  "oficio",
  "prestacao_contas",
  "relatorio",
];

function isTipo(v: unknown): v is DocumentoModeloTipo {
  return typeof v === "string" && TIPOS.includes(v as DocumentoModeloTipo);
}

type PatchBody = {
  modelo?: {
    nome?: string;
    tipo?: string;
    descricao?: string;
    assunto?: string;
    logoUrl?: string;
    cabecalhoHtml?: string;
    corpo?: string;
    rodapeHtml?: string;
    timbreId?: string;
    ativo?: boolean;
  };
};

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await configuracoesAccessGate(req, CONFIG_RESOURCES.construtorDocumentos, "editar");
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const body = await parseJsonSafe<PatchBody>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const m = body.value.modelo;
  if (!m || typeof m !== "object") return fail("BAD_REQUEST", "Payload inválido.", 400);

  const existing = await prisma.documentoModelo.findUnique({ where: { id } });
  if (!existing) return fail("NOT_FOUND", "Modelo não encontrado.", 404);

  const nome = m.nome !== undefined ? m.nome.trim() : existing.nome;
  if (!nome) return fail("BAD_REQUEST", "Nome do modelo não pode ficar vazio.", 400);

  let tipo: DocumentoModeloTipo = existing.tipo;
  if (m.tipo !== undefined) {
    if (!isTipo(m.tipo)) return fail("BAD_REQUEST", "Tipo de documento inválido.", 400);
    tipo = m.tipo;
  }

  const descricao = m.descricao !== undefined ? m.descricao.trim() : existing.descricao;
  const assunto = m.assunto !== undefined ? m.assunto.trim() : existing.assunto;
  const logoUrl = m.logoUrl !== undefined ? m.logoUrl.trim() : existing.logoUrl;
  const cabecalhoHtml = m.cabecalhoHtml !== undefined ? m.cabecalhoHtml : existing.cabecalhoHtml;
  const corpo = m.corpo !== undefined ? m.corpo : existing.corpo;
  const rodapeHtml = m.rodapeHtml !== undefined ? m.rodapeHtml : existing.rodapeHtml;
  if (!htmlTemTextoVisivel(corpo)) return fail("BAD_REQUEST", "Corpo do documento não pode ficar vazio.", 400);

  const ativo = m.ativo !== undefined ? Boolean(m.ativo) : existing.ativo;

  const contentChanged =
    nome !== existing.nome ||
    tipo !== existing.tipo ||
    descricao !== existing.descricao ||
    assunto !== existing.assunto ||
    logoUrl !== existing.logoUrl ||
    cabecalhoHtml !== existing.cabecalhoHtml ||
    corpo !== existing.corpo ||
    rodapeHtml !== existing.rodapeHtml ||
    ativo !== existing.ativo;
  const nextTimbreId = m.timbreId !== undefined ? m.timbreId.trim() : undefined;

  if (!contentChanged && nextTimbreId === undefined) {
    return ok({ modelo: documentoModeloToDto(existing) });
  }

  try {
    if (nextTimbreId !== undefined) {
      const cfg = await getDocumentoTimbresConfig();
      if (nextTimbreId && !cfg.items.some((x) => x.id === nextTimbreId)) {
        return fail("BAD_REQUEST", "Papel timbrado selecionado não existe.", 400);
      }
      if (nextTimbreId) cfg.modeloTimbreById[id] = nextTimbreId;
      else delete cfg.modeloTimbreById[id];
      await saveDocumentoTimbresConfig(cfg);
    }

    const updated = await prisma.documentoModelo.update({
      where: { id },
      data: {
        nome,
        tipo,
        descricao,
        assunto,
        logoUrl,
        cabecalhoHtml,
        corpo,
        rodapeHtml,
        ativo,
        versao: { increment: 1 },
      },
    });
    await writeAuditLog(prisma, {
      acao: "Modelo de documento atualizado",
      modulo: "configuracoes",
      detalhes: `${updated.nome} (v${updated.versao})`,
    });
    return ok({ modelo: documentoModeloToDto(updated) });
  } catch {
    return fail("INTERNAL_ERROR", "Não foi possível salvar o modelo.", 500);
  }
}
