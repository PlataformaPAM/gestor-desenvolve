import type { DocumentoModelo, DocumentoModeloTipo } from "@prisma/client";

export type DocumentoModeloDto = {
  id: string;
  nome: string;
  tipo: DocumentoModeloTipo;
  descricao: string;
  assunto: string;
  logoUrl: string;
  cabecalhoHtml: string;
  corpo: string;
  rodapeHtml: string;
  ativo: boolean;
  versao: number;
  /** ISO */
  atualizadoEm: string;
};

export function documentoModeloToDto(row: DocumentoModelo): DocumentoModeloDto {
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo,
    descricao: row.descricao ?? "",
    assunto: row.assunto ?? "",
    logoUrl: row.logoUrl ?? "",
    cabecalhoHtml: row.cabecalhoHtml ?? "",
    corpo: row.corpo,
    rodapeHtml: row.rodapeHtml ?? "",
    ativo: row.ativo,
    versao: row.versao,
    atualizadoEm: row.updatedAt.toISOString(),
  };
}
