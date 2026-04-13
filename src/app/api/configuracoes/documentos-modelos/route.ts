import { prisma } from "@/lib/prisma";
import { documentoModeloToDto } from "@/lib/configuracoes/documentos-modelos";
import { getEmpresaDocumentoConfig } from "@/lib/documentos/empresa-config";
import { htmlTemTextoVisivel } from "@/lib/documentos/html-text";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
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

export async function GET() {
  try {
    const rows = await prisma.documentoModelo.findMany({
      orderBy: { updatedAt: "desc" },
    });
    return ok({ modelos: rows.map(documentoModeloToDto) });
  } catch {
    return fail("INTERNAL_ERROR", "NÃ£o foi possÃ­vel carregar os modelos de documento.", 500);
  }
}

type CreateBody = {
  modelo?: {
    nome?: string;
    tipo?: string;
    descricao?: string;
    assunto?: string;
    logoUrl?: string;
    cabecalhoHtml?: string;
    corpo?: string;
    rodapeHtml?: string;
    ativo?: boolean;
  };
};

export async function POST(req: Request) {
  const body = await parseJsonSafe<CreateBody>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON invÃ¡lido.", 400);
  const m = body.value.modelo;
  if (!m?.nome?.trim()) return fail("BAD_REQUEST", "Informe o nome do modelo.", 400);
  if (!isTipo(m.tipo)) return fail("BAD_REQUEST", "Tipo de documento invÃ¡lido.", 400);
  if (!htmlTemTextoVisivel(m.corpo ?? "")) return fail("BAD_REQUEST", "Informe o corpo do documento.", 400);

  try {
    const empresa = await getEmpresaDocumentoConfig();
    const created = await prisma.documentoModelo.create({
      data: {
        nome: m.nome.trim(),
        tipo: m.tipo,
        descricao: m.descricao?.trim() ?? "",
        assunto: m.assunto?.trim() ?? "",
        logoUrl: m.logoUrl?.trim() || empresa.logoUrl || "",
        cabecalhoHtml: m.cabecalhoHtml || empresa.cabecalhoPadraoHtml || "",
        corpo: m.corpo ?? "",
        rodapeHtml: m.rodapeHtml || empresa.rodapePadraoHtml || "",
        ativo: m.ativo ?? true,
        versao: 1,
      },
    });
    try {
      await writeAuditLog(prisma, {
        acao: "Modelo de documento criado",
        modulo: "configuracoes",
        detalhes: `${created.nome} (${created.tipo})`,
      });
    } catch (auditErr) {
      if (process.env.NODE_ENV === "development") {
        console.error("[documentos-modelos POST] writeAuditLog falhou (modelo jÃ¡ criado):", auditErr);
      }
    }
    return ok({ modelo: documentoModeloToDto(created) }, 201);
  } catch {
    return fail("INTERNAL_ERROR", "NÃ£o foi possÃ­vel criar o modelo. Verifique se a migraÃ§Ã£o do banco foi aplicada.", 500);
  }
}
