"use client";

import { useState } from "react";
import type { Lancamento, LancamentoTipo, TipoRecorrencia } from "@/lib/financeiro/types";
import { splitValorTotalEmParcelas } from "@/lib/financeiro/lancamento-utils";
import clsx from "clsx";

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

  const n = Math.max(2, tipoRecorrencia === "parcelado" ? parcelas : 12);
  const batch = newBatchStamp();
  const idPai = generateId("g", batch, 0);
  const valoresParcelas =
    tipoRecorrencia === "parcelado" ? splitValorTotalEmParcelas(valor, n) : null;
  const list: Lancamento[] = [];

  for (let i = 0; i < n; i++) {
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
  const [parcelas, setParcelas] = useState(12);

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
      tipoRecorrencia === "parcelado" ? Math.max(2, parcelas) : 12
    );
    onSave(list);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="novo-tipo" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Tipo
        </label>
        <select
          id="novo-tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as LancamentoTipo)}
          className={clsx(
            "mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2",
            tipo === "entrada"
              ? "border-emerald-200 bg-emerald-50/50 text-emerald-900 focus:ring-emerald-500"
              : "border-red-200 bg-red-50/50 text-red-900 focus:ring-red-500"
          )}
        >
          <option value="entrada">Entrada (Receber)</option>
          <option value="saida">Saída (Pagar)</option>
        </select>
      </div>

      <div>
        <label htmlFor="novo-desc" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Descrição
        </label>
        <input
          id="novo-desc"
          type="text"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex.: Mensalidade Nov/2025"
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          required
        />
      </div>

      <div>
        <label htmlFor="novo-venc" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Vencimento
        </label>
        <input
          id="novo-venc"
          type="date"
          value={vencimento}
          onChange={(e) => setVencimento(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]"
          required
        />
      </div>

      <div>
        <label htmlFor="novo-tipo-rec" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Tipo de Lançamento
        </label>
        <select
          id="novo-tipo-rec"
          value={tipoRecorrencia}
          onChange={(e) => setTipoRecorrencia(e.target.value as TipoRecorrencia)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
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
            "Projeta o mesmo valor para os próximos 12 meses no fluxo de caixa."}
          {tipoRecorrencia === "parcelado" &&
            "O valor informado é o total do acordo: o sistema divide em N parcelas de mesmo valor (centavos distribuídos nas primeiras parcelas, se necessário), com vencimento mensal a partir da data."}
        </p>
      </div>

      {tipoRecorrencia === "parcelado" && (
        <div>
          <label htmlFor="novo-parcelas" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Quantidade de Parcelas
          </label>
          <input
            id="novo-parcelas"
            type="number"
            min={2}
            max={60}
            value={parcelas}
            onChange={(e) => setParcelas(Math.max(2, parseInt(e.target.value, 10) || 2))}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      )}

      <div>
        <label htmlFor="novo-valor" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
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
            "mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2",
            tipo === "entrada"
              ? "border-emerald-200 bg-emerald-50/30 text-emerald-900 focus:ring-emerald-500 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-200 dark:focus:ring-emerald-600"
              : "border-red-200 bg-red-50/30 text-red-900 focus:ring-red-500 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-200 dark:focus:ring-red-600"
          )}
          required
        />
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-lg bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
        >
          Salvar
        </button>
      </div>
    </form>
  );
}
