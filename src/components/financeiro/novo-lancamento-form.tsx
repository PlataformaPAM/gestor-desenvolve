"use client";

import { useState } from "react";
import type { Lancamento, LancamentoTipo, TipoRecorrencia } from "@/lib/financeiro/types";
import { LANCAMENTO_FIXO_MENSAL_PROJECAO_MESES } from "@/lib/financeiro/constants";
import { splitValorTotalEmParcelas } from "@/lib/financeiro/lancamento-utils";
import clsx from "clsx";
import { Save, X } from "lucide-react";
import { DateField } from "@/components/ui/date-field";
import {
  formLabelClass,
  formInputClass,
  formNativeSelectClass,
  formModalCancelButtonClass,
  formModalSubmitButtonClass,
} from "@/components/ui/field-patterns";

const TIPO_RECORRENCIA_OPTIONS: { value: TipoRecorrencia; label: string }[] = [
  { value: "unico", label: "Único" },
  { value: "fixo_mensal", label: "Fixo Mensal" },
  { value: "parcelado", label: "Parcelado" },
];

function nextMonth(isoDate: string, addMonths: number): string {
  const d = new Date(isoDate);
  d.setMonth(d.getMonth() + addMonths);
  return d.toISOString().slice(0, 10);
}

function newBatchStamp(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function generateId(prefix: string, batch: string, i: number): string {
  return `nl-${batch}-${prefix}-${i}`;
}

/** Gera os lançamentos conforme tipo de recorrência (único, fixo mensal ou parcelado). */
export function buildLancamentosFromForm(
  tipo: LancamentoTipo,
  descricao: string,
  vencimento: string,
  valor: number,
  tipoRecorrencia: TipoRecorrencia,
  parcelas: number,
  clienteId?: string,
  fornecedor?: string
): Lancamento[] {
  const base: Omit<Lancamento, "id" | "vencimento" | "parcelaNumero" | "idPai"> = {
    tipo,
    descricao,
    valor,
    status: "pendente",
    tipoRecorrencia: tipoRecorrencia === "unico" ? undefined : tipoRecorrencia,
    parcelas: tipoRecorrencia === "unico" ? undefined : parcelas,
  };
  if (clienteId) (base as Lancamento).clienteId = clienteId;
  if (fornecedor) (base as Lancamento).fornecedor = fornecedor;

  if (tipoRecorrencia === "unico") {
    return [{ ...base, id: generateId("u", newBatchStamp(), 0), vencimento } as Lancamento];
  }

  const n = Math.max(2, tipoRecorrencia === "parcelado" ? parcelas : LANCAMENTO_FIXO_MENSAL_PROJECAO_MESES);
  const batch = newBatchStamp();
  const idPai = generateId("g", batch, 0);
  const valoresParcelas =
    tipoRecorrencia === "parcelado" ? splitValorTotalEmParcelas(valor, n) : null;
  const list: Lancamento[] = [];

  for (let i = 0; i < n; i += 1) {
    const venc = nextMonth(vencimento, i);
    const isFirst = i === 0;
    list.push({
      ...base,
      id: isFirst ? idPai : generateId("g", batch, i),
      vencimento: venc,
      valor: valoresParcelas ? valoresParcelas[i]! : valor,
      idPai: isFirst ? undefined : idPai,
      parcelaNumero: tipoRecorrencia === "parcelado" ? i + 1 : undefined,
      descricao,
    } as Lancamento);
  }
  return list;
}

type NovoLancamentoFormProps = {
  onSave: (lancamentos: Lancamento[]) => void;
  onCancel: () => void;
};

export function NovoLancamentoForm({ onSave, onCancel }: NovoLancamentoFormProps) {
  const [tipo, setTipo] = useState<LancamentoTipo>("entrada");
  const [descricao, setDescricao] = useState("");
  const [vencimento, setVencimento] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [valor, setValor] = useState("");
  const [tipoRecorrencia, setTipoRecorrencia] = useState<TipoRecorrencia>("unico");
  const [parcelas, setParcelas] = useState(LANCAMENTO_FIXO_MENSAL_PROJECAO_MESES);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valorNum = parseFloat(valor.replace(",", ".")) || 0;
    if (!descricao.trim() || valorNum <= 0) return;

    const list = buildLancamentosFromForm(
      tipo,
      descricao.trim(),
      vencimento,
      valorNum,
      tipoRecorrencia,
      tipoRecorrencia === "parcelado" ? Math.max(2, parcelas) : LANCAMENTO_FIXO_MENSAL_PROJECAO_MESES
    );
    onSave(list);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="novo-tipo" className={formLabelClass}>
          Tipo
        </label>
        <select
          id="novo-tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as LancamentoTipo)}
          className={clsx(
            formNativeSelectClass,
            tipo === "entrada"
              ? "border-emerald-200 bg-emerald-50/50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "border-red-200 bg-red-50/50 text-red-900 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-200"
          )}
        >
          <option value="entrada">Entrada (Receber)</option>
          <option value="saida">Saída (Pagar)</option>
        </select>
      </div>

      <div>
        <label htmlFor="novo-desc" className={formLabelClass}>
          Descrição
        </label>
        <input
          id="novo-desc"
          type="text"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex.: Mensalidade Nov/2025"
          className={formInputClass}
          required
        />
      </div>

      <div>
        <label htmlFor="novo-venc" className={formLabelClass}>
          Vencimento
        </label>
        <DateField
          id="novo-venc"
          value={vencimento}
          onChange={setVencimento}
          placeholder="Selecione a data"
        />
      </div>

      <div>
        <label htmlFor="novo-tipo-rec" className={formLabelClass}>
          Tipo de Lançamento
        </label>
        <select
          id="novo-tipo-rec"
          value={tipoRecorrencia}
          onChange={(e) => setTipoRecorrencia(e.target.value as TipoRecorrencia)}
          className={formNativeSelectClass}
        >
          {TIPO_RECORRENCIA_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {tipoRecorrencia === "unico" && "Lançamento padrão, uma única vez."}
          {tipoRecorrencia === "fixo_mensal" &&
            `Projeta o mesmo valor para os próximos ${LANCAMENTO_FIXO_MENSAL_PROJECAO_MESES} meses no fluxo de caixa.`}
          {tipoRecorrencia === "parcelado" &&
            "O valor informado é o total do acordo: o sistema divide em N parcelas de mesmo valor (centavos distribuídos nas primeiras parcelas, se necessário), com vencimento mensal a partir da data."}
        </p>
      </div>

      {tipoRecorrencia === "parcelado" && (
        <div>
          <label htmlFor="novo-parcelas" className={formLabelClass}>
            Quantidade de Parcelas
          </label>
          <input
            id="novo-parcelas"
            type="number"
            min={2}
            max={60}
            value={parcelas}
            onChange={(e) => setParcelas(Math.max(2, parseInt(e.target.value, 10) || 2))}
            className={formInputClass}
          />
        </div>
      )}

      <div>
        <label htmlFor="novo-valor" className={formLabelClass}>
          Valor (R$)
        </label>
        <input
          id="novo-valor"
          type="number"
          step="0.01"
          min="0"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="0,00"
          className={clsx(
            formInputClass,
            tipo === "entrada"
              ? "border-emerald-200 bg-emerald-50/30 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "border-red-200 bg-red-50/30 text-red-900 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-200"
          )}
          required
        />
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
        <button type="button" onClick={onCancel} className={formModalCancelButtonClass}>
          <span className="inline-flex items-center gap-2">
            <X className="h-4 w-4 shrink-0" aria-hidden />
            Cancelar
          </span>
        </button>
        <button type="submit" className={formModalSubmitButtonClass}>
          <span className="inline-flex items-center gap-2">
            <Save className="h-4 w-4 shrink-0" aria-hidden />
            Salvar
          </span>
        </button>
      </div>
    </form>
  );
}
