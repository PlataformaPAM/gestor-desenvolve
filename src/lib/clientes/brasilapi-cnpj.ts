import type { ClienteEndereco } from "./types";

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
 * Consulta CNPJ via rota interna (proxy para BrasilAPI) (14 dígitos).
 * Preenche: Razão Social, Nome Fantasia, CEP, Logradouro, Bairro, Cidade, UF.
 * Número e complemento vêm da API quando disponíveis; e-mail e telefone podem vir vazios.
 */
export async function fetchCnpjBrasilApi(cnpj: string): Promise<CnpjConsultaResult | null> {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) return null;

  try {
    const res = await fetch(`/api/clientes/cnpj/${encodeURIComponent(digits)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: CnpjConsultaResult;
      success?: boolean;
    };
    if (!body?.success || !body.data) return null;
    const data = body.data;

    return data;
  } catch {
    return null;
  }
}
