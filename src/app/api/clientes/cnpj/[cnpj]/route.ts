import { fail, ok } from "@/lib/server/api-response";
import { clientesAccessGate } from "@/lib/server/clientes-access";

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

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function formatCnpj(digits: string): string {
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatCep(digits: string): string {
  if (digits.length < 8) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

export async function GET(req: Request, ctx: { params: Promise<{ cnpj: string }> }) {
  const gate = await clientesAccessGate(req, "ver");
  if (!gate.ok) return gate.response;

  const { cnpj: cnpjParam } = await ctx.params;
  const digits = onlyDigits(cnpjParam);
  if (digits.length !== 14) {
    return fail("BAD_REQUEST", "CNPJ inválido.", 400);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "gestor-desenvolve/1.0",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) {
      return fail("BAD_REQUEST", "Não foi possível consultar o CNPJ na Receita.", 400);
    }

    const data = (await resp.json()) as BrasilApiCnpjResponse;
    const cepDigits = data.cep ? onlyDigits(data.cep) : "";
    return ok({
      cpfCnpj: formatCnpj(digits),
      empresa: data.razao_social ?? "",
      nomeFantasia: data.nome_fantasia ?? data.razao_social ?? "",
      endereco: {
        logradouro: data.logradouro ?? "",
        numero: data.numero ?? "",
        complemento: data.complemento ?? undefined,
        bairro: data.bairro ?? "",
        cidade: data.municipio ?? "",
        uf: data.uf ?? "",
        cep: formatCep(cepDigits),
      },
      telefone: data.ddd_telefone_1 ?? undefined,
      email: data.email ?? undefined,
    });
  } catch {
    return fail("BAD_REQUEST", "Falha ao consultar CNPJ. Tente novamente em instantes.", 400);
  }
}
