/** Dias até a data de fim (0 = hoje, negativo = já passou). Só calendário local. */
export function diasAteFimContrato(dataFimIso: string | null | undefined): number | null {
  if (!dataFimIso) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const f = new Date(dataFimIso);
  f.setHours(0, 0, 0, 0);
  return Math.round((f.getTime() - hoje.getTime()) / 86400000);
}

export type BadgeContratoUrgencia = { texto: string; variant: "atraso" | "urgente" };

/**
 * VENCIDO: data de fim no passado (exceto encerrado/cancelado).
 * VENCE LOGO: contrato ativo com fim entre 1 e 60 dias, em faixas 5 / 15 / 30 / 60.
 */
export function badgeUrgenciaContrato(
  dataFimIso: string | null | undefined,
  status: string
): BadgeContratoUrgencia | null {
  if (!dataFimIso) return null;
  if (status === "encerrado" || status === "cancelado") return null;

  const dias = diasAteFimContrato(dataFimIso);
  if (dias === null) return null;

  if (dias < 0) {
    return { texto: "VENCIDO", variant: "atraso" };
  }

  if (status !== "ativo") {
    return null;
  }

  if (dias === 0) {
    return { texto: "VENCE HOJE", variant: "urgente" };
  }

  if (dias <= 5) return { texto: "VENCE LOGO · 5 dias", variant: "urgente" };
  if (dias <= 15) return { texto: "VENCE LOGO · 15 dias", variant: "urgente" };
  if (dias <= 30) return { texto: "VENCE LOGO · 30 dias", variant: "urgente" };
  if (dias <= 60) return { texto: "VENCE LOGO · 60 dias", variant: "urgente" };

  return null;
}

export function contratoLinhaComAlertaVisual(
  dataFimIso: string | null | undefined,
  status: string
): boolean {
  return badgeUrgenciaContrato(dataFimIso, status) != null;
}
