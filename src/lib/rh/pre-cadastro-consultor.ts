import type { ColaboradorParceiro, TipoPessoaRH } from "@/lib/rh/types";

/** Valor interno de `cargoOuFuncao` enquanto o consultor está só em pré-cadastro (coluna NOT NULL no BD). */
export const RH_CONSULTOR_PRE_CADASTRO_CARGO = "__PRE_CADASTRO_RH__";

export function normalizeNomeRh(nome: string): string {
  return nome.trim().replace(/\s+/g, " ").toLowerCase();
}

export function isConsultorPreCadastro(c: {
  tipo: TipoPessoaRH;
  cadastroEfetivado?: boolean;
  cargoOuFuncao?: string;
}): boolean {
  if (c.tipo !== "vendedor_externo") return false;
  if (c.cadastroEfetivado === false) return true;
  if (c.cadastroEfetivado === true) return false;
  return c.cargoOuFuncao === RH_CONSULTOR_PRE_CADASTRO_CARGO;
}

export function displayCargoRh(c: Pick<ColaboradorParceiro, "cargoOuFuncao" | "cadastroEfetivado" | "tipo">): string {
  if (c.tipo !== "vendedor_externo") return c.cargoOuFuncao;
  if (c.cargoOuFuncao === RH_CONSULTOR_PRE_CADASTRO_CARGO || c.cadastroEfetivado === false) {
    return "—";
  }
  return c.cargoOuFuncao;
}
