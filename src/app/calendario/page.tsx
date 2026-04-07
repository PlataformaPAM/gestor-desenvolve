"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePageHeader } from "@/contexts/page-header-context";
import { NovoEventoModal } from "./novo-evento-modal";

/** Estrutura compatível com Google Calendar API (preparação para integração). */
export type CalendarioEvento = {
  id: string;
  titulo: string;
  dataInicio: string; // ISO
  dataFim: string;   // ISO
  descricao?: string;
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const PRIMARY = "#6D28D9";

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function eventoCaiNoDia(ev: CalendarioEvento, dateKey: string): boolean {
  const inicio = ev.dataInicio.slice(0, 10);
  const fim = ev.dataFim.slice(0, 10);
  return dateKey >= inicio && dateKey <= fim;
}

function getStartOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function eventoCaiNoHorario(ev: CalendarioEvento, dateKey: string, hora: number): boolean {
  const [y, m, d] = dateKey.split("-").map(Number);
  const slotStart = new Date(y, m - 1, d, hora, 0, 0);
  const slotEnd = new Date(y, m - 1, d, hora + 1, 0, 0);
  const inicio = new Date(ev.dataInicio);
  const fim = new Date(ev.dataFim);
  return inicio < slotEnd && fim > slotStart;
}

export default function CalendarioPage() {
  const { setPrimaryAction } = usePageHeader();
  const [view, setView] = useState<"day" | "week" | "month">("month");
  const [focalDate, setFocalDate] = useState(() => new Date());
  const [modalAberto, setModalAberto] = useState(false);
  const [dataPreenchida, setDataPreenchida] = useState<string | undefined>();

  const ano = focalDate.getFullYear();
  const mes = focalDate.getMonth();

  const [calendarEvents, setCalendarEvents] = useState<CalendarioEvento[]>([
    {
      id: "e1",
      titulo: "Reunião Cliente X",
      dataInicio: "2025-03-10T14:00:00.000Z",
      dataFim: "2025-03-10T15:00:00.000Z",
      descricao: "Apresentação proposta",
    },
    {
      id: "e2",
      titulo: "Entrega documentação",
      dataInicio: "2025-03-15T09:00:00.000Z",
      dataFim: "2025-03-15T17:00:00.000Z",
    },
    {
      id: "e3",
      titulo: "Call trimestral",
      dataInicio: "2025-03-18T10:00:00.000Z",
      dataFim: "2025-03-18T11:30:00.000Z",
    },
    {
      id: "e4",
      titulo: "Workshop interno",
      dataInicio: "2025-03-20T08:00:00.000Z",
      dataFim: "2025-03-20T12:00:00.000Z",
      descricao: "Treinamento nova ferramenta",
    },
  ]);

  useEffect(() => {
    setPrimaryAction({
      label: "Novo Evento",
      onClick: () => {
        setDataPreenchida(undefined);
        setModalAberto(true);
      },
    });
    return () => setPrimaryAction(null);
  }, [setPrimaryAction]);

  const { dias } = useMemo(() => {
    const primeiro = new Date(ano, mes, 1);
    const ultimo = new Date(ano, mes + 1, 0);
    const primeiroDiaSemana = primeiro.getDay();
    const totalDias = ultimo.getDate();
    const dias: (number | null)[] = [];
    for (let i = 0; i < primeiroDiaSemana; i++) dias.push(null);
    for (let d = 1; d <= totalDias; d++) dias.push(d);
    const resto = 7 - (dias.length % 7);
    if (resto < 7) for (let i = 0; i < resto; i++) dias.push(null);
    return { dias };
  }, [ano, mes]);

  const handlePrev = () => {
    if (view === "month") {
      setFocalDate(new Date(ano, mes - 1, 1));
    } else if (view === "week") {
      const d = new Date(focalDate);
      d.setDate(d.getDate() - 7);
      setFocalDate(d);
    } else {
      const d = new Date(focalDate);
      d.setDate(d.getDate() - 1);
      setFocalDate(d);
    }
  };

  const handleNext = () => {
    if (view === "month") {
      setFocalDate(new Date(ano, mes + 1, 1));
    } else if (view === "week") {
      const d = new Date(focalDate);
      d.setDate(d.getDate() + 7);
      setFocalDate(d);
    } else {
      const d = new Date(focalDate);
      d.setDate(d.getDate() + 1);
      setFocalDate(d);
    }
  };

  const handleHoje = () => {
    setFocalDate(new Date());
  };

  const handleClickDia = (dia: number) => {
    const dateKey = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    setDataPreenchida(dateKey);
    setModalAberto(true);
  };

  const handleClickDate = (dateKey: string) => {
    setDataPreenchida(dateKey);
    setModalAberto(true);
  };

  const handleSalvarEvento = (ev: Omit<CalendarioEvento, "id">) => {
    setCalendarEvents((prev) => [
      ...prev,
      { ...ev, id: `e-${Date.now()}` },
    ]);
  };

  const hojeKey = toDateKey(new Date());

  const headerTitle =
    view === "month"
      ? `${MESES[mes]} ${ano}`
      : view === "week"
        ? (() => {
            const start = getStartOfWeek(focalDate);
            const end = new Date(start);
            end.setDate(end.getDate() + 6);
            return `${start.getDate()} – ${end.getDate()} ${MESES[end.getMonth()]} ${end.getFullYear()}`;
          })()
        : `${focalDate.getDate()} ${MESES[focalDate.getMonth()]} ${ano}`;

  const HORAS = Array.from({ length: 16 }, (_, i) => i + 6);

  const weekStart = getStartOfWeek(focalDate);
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return toDateKey(d);
  });

  return (
    <section className="space-y-6">
      {/* Header: Hoje, setas, título (mês/semana/dia), select de vista — só o botão do header global abre o modal */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleHoje}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Hoje
          </button>
          <div className="flex items-center">
            <button
              type="button"
              onClick={handlePrev}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label="Próximo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <h2 className="min-w-0 text-lg font-semibold text-slate-900 dark:text-slate-100 sm:min-w-[180px] sm:text-xl">
            {headerTitle}
          </h2>
        </div>
        <select
          value={view}
          onChange={(e) => setView(e.target.value as "day" | "week" | "month")}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="day">Dia</option>
          <option value="week">Semana</option>
          <option value="month">Mês</option>
        </select>
      </div>

      {/* Vista Mês: grid de dias */}
      {view === "month" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900 shadow-sm">
          <div className="overflow-x-auto">
          <div className="grid min-w-[640px] sm:min-w-[720px] grid-cols-7 border-b border-gray-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/80">
            {WEEKDAYS.map((wd) => (
              <div
                key={wd}
                className="border-r border-gray-200 py-2 text-center text-xs font-semibold text-slate-600 last:border-r-0 dark:border-slate-700 dark:text-slate-400"
              >
                {wd}
              </div>
            ))}
          </div>
          <div className="grid min-w-[640px] sm:min-w-[720px] grid-cols-7">
            {dias.map((dia, idx) => {
              const dateKey =
                dia === null
                  ? ""
                  : `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
              const eventosDoDia = dateKey
                ? calendarEvents.filter((e) => eventoCaiNoDia(e, dateKey))
                : [];
              const ehHoje = dateKey === hojeKey;
              return (
                <div
                  key={idx}
                  className={`min-h-[100px] border-r border-b border-gray-200 p-1 last:border-r-0 ${
                    dia === null
                      ? "bg-slate-50/50 dark:bg-slate-800/30"
                      : "bg-white hover:bg-slate-50/80 dark:bg-slate-900 dark:hover:bg-slate-800/80"
                  }`}
                >
                  {dia !== null ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleClickDia(dia)}
                        className={`mb-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors hover:opacity-90 ${
                          ehHoje
                            ? "text-white"
                            : "text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700"
                        }`}
                        style={ehHoje ? { backgroundColor: PRIMARY } : undefined}
                      >
                        {dia}
                      </button>
                      <div className="space-y-1">
                        {eventosDoDia.slice(0, 3).map((ev) => (
                          <div
                            key={ev.id}
                            className="truncate rounded px-1.5 py-0.5 text-xs font-medium text-white"
                            style={{ backgroundColor: PRIMARY }}
                            title={ev.titulo}
                          >
                            {ev.titulo}
                          </div>
                        ))}
                        {eventosDoDia.length > 3 && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            +{eventosDoDia.length - 3} mais
                          </div>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
          </div>
        </div>
      )}

      {/* Vista Semana: 7 colunas (dias) + linhas de horário */}
      {view === "week" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900 shadow-sm">
          <div className="overflow-x-auto">
          <div className="grid min-w-[720px] sm:min-w-[880px] grid-cols-8 border-b border-gray-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/80">
            <div className="border-r border-gray-200 py-2 text-center text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-400" />
            {weekDates.map((dk) => {
              const d = new Date(dk + "T12:00:00");
              const ehHoje = dk === hojeKey;
              return (
                <div
                  key={dk}
                  className={`border-r border-gray-200 py-2 text-center text-xs font-semibold last:border-r-0 dark:border-slate-700 ${ehHoje ? "text-violet-700 dark:text-violet-300" : "text-slate-600 dark:text-slate-400"}`}
                >
                  {WEEKDAYS[d.getDay()]} {d.getDate()}
                </div>
              );
            })}
          </div>
          <div className="overflow-visible">
            {HORAS.map((h) => (
              <div key={h} className="grid min-w-[720px] sm:min-w-[880px] grid-cols-8 border-b border-gray-100 dark:border-slate-800">
                <div className="border-r border-gray-200 py-1 pr-2 text-right text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  {String(h).padStart(2, "0")}:00
                </div>
                {weekDates.map((dateKey) => {
                  const eventos = calendarEvents.filter((e) =>
                    eventoCaiNoHorario(e, dateKey, h)
                  );
                  return (
                    <div
                      key={dateKey}
                      className="min-h-[48px] border-r border-gray-200 last:border-r-0 dark:border-slate-700"
                    >
                      <button
                        type="button"
                        onClick={() => handleClickDate(dateKey)}
                        className="h-full w-full text-left text-xs text-slate-400 hover:bg-violet-50/50 dark:text-slate-500 dark:hover:bg-violet-950/30"
                      >
                        {eventos.map((ev) => (
                          <div
                            key={ev.id}
                            className="truncate rounded px-1 py-0.5 text-xs font-medium text-white"
                            style={{ backgroundColor: PRIMARY }}
                          >
                            {ev.titulo}
                          </div>
                        ))}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          </div>
        </div>
      )}

      {/* Vista Dia: uma coluna com horas do dia */}
      {view === "day" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900 shadow-sm">
          <div className="border-b border-gray-200 bg-slate-50/80 px-4 py-2 text-center text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
            {focalDate.getDate()} {MESES[focalDate.getMonth()]} {ano}
          </div>
          <div className="overflow-visible">
            {HORAS.map((h) => {
              const dateKey = toDateKey(focalDate);
              const eventos = calendarEvents.filter((e) =>
                eventoCaiNoHorario(e, dateKey, h)
              );
              return (
                <div
                  key={h}
                  className="flex border-b border-gray-100 min-h-[56px] dark:border-slate-800"
                >
                  <div className="w-14 shrink-0 border-r border-gray-200 py-1 pr-2 text-right text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {String(h).padStart(2, "0")}:00
                  </div>
                  <button
                    type="button"
                    onClick={() => handleClickDate(dateKey)}
                    className="min-h-[56px] flex-1 text-left text-xs text-slate-400 hover:bg-violet-50/50 dark:text-slate-500 dark:hover:bg-violet-950/30"
                  >
                    {eventos.map((ev) => (
                      <div
                        key={ev.id}
                        className="truncate rounded px-2 py-1 text-xs font-medium text-white"
                        style={{ backgroundColor: PRIMARY }}
                      >
                        {ev.titulo}
                      </div>
                    ))}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <NovoEventoModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        dataPreenchida={dataPreenchida}
        onSalvar={handleSalvarEvento}
      />
    </section>
  );
}
