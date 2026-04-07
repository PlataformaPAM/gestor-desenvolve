import type { ClienteEndereco } from "./types";

/** Resposta da BrasilAPI para CNPJ (campos usados) */
type BrasilApiCnpjResponse = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string | null;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string | null;
  bairro?: string;
  municipio?: string;
  uf?: string;
  ddd_telefone_1?: string | null;
  email?: string | null;
};

export type CnpjConsultaResult = {
  cpfCnpj: string;
  empresa: string; // razão social
  nomeFantasia: string;
  endereco: Partial<ClienteEndereco>;
  telefone?: string;
  email?: string;
};

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Consulta CNPJ na BrasilAPI (14 dígitos).
 * Preenche: Razão Social, Nome Fantasia, CEP, Logradouro, Bairro, Cidade, UF.
 * Número e complemento vêm da API quando disponíveis; e-mail e telefone podem vir vazios.
 */
export async function fetchCnpjBrasilApi(cnpj: string): Promise<CnpjConsultaResult | null> {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) return null;

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as BrasilApiCnpjResponse;

    const cep = data.cep ? onlyDigits(data.cep) : "";
    const formatCep = (v: string) =>
      v.length >= 8 ? `${v.slice(0, 5)}-${v.slice(5, 8)}` : v;

    return {
      cpfCnpj: digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"),
      empresa: data.razao_social ?? "",
      nomeFantasia: data.nome_fantasia ?? data.razao_social ?? "",
      endereco: {
        logradouro: data.logradouro ?? "",
        numero: data.numero ?? "",
        complemento: data.complemento ?? undefined,
        bairro: data.bairro ?? "",
        cidade: data.municipio ?? "",
        uf: data.uf ?? "",
        cep: formatCep(cep),
      },
      telefone: data.ddd_telefone_1
        ? `(${data.uf?.slice(0, 2) ?? ""}) ${data.ddd_telefone_1}`
        : undefined,
      email: data.email ?? undefined,
    };
  } catch {
    return null;
  }
}
