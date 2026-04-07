"use client";

import { useState } from "react";
import {
  Users,
  MapPin,
  Paperclip,
  Video,
  Calendar,
  Clock,
} from "lucide-react";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import type { CalendarioEvento } from "./page";

type TipoEvento = "evento" | "tarefa" | "lembrete";

type NovoEventoModalProps = {
  open: boolean;
  onClose: () => void;
  dataPreenchida?: string; // YYYY-MM-DD
  onSalvar: (ev: Omit<CalendarioEvento, "id">) => void;
};

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toLocalTimeString(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function NovoEventoModal({
  open,
  onClose,
  dataPreenchida,
  onSalvar,
}: NovoEventoModalProps) {
  const hoje = new Date();
  const dataBase = dataPreenchida
    ? new Date(dataPreenchida + "T12:00:00")
    : hoje;
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoEvento>("evento");
  const [dataInicio, setDataInicio] = useState(toLocalDateString(dataBase));
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [dataFim, setDataFim] = useState(toLocalDateString(dataBase));
  const [horaFim, setHoraFim] = useState("10:00");
  const [diaTodo, setDiaTodo] = useState(false);
  const [convidados, setConvidados] = useState("");
  const [local, setLocal] = useState("");
  const [descricao, setDescricao] = useState("");

  const handleSalvar = () => {
    const inicio = diaTodo
      ? `${dataInicio}T00:00:00.000Z`
      : `${dataInicio}T${horaInicio}:00.000Z`;
    const fim = diaTodo
      ? `${dataFim}T23:59:59.999Z`
      : `${dataFim}T${horaFim}:00.000Z`;
    onSalvar({
      titulo: titulo || "Sem título",
      dataInicio: inicio,
      dataFim: fim,
      descricao: descricao || undefined,
    });
    onClose();
    setTitulo("");
    setTipo("evento");
    setDiaTodo(false);
    setConvidados("");
    setLocal("");
    setDescricao("");
  };

  return (
    <DrawerSheet open={open} onClose={onClose} title="Novo evento" maxWidth="sm:max-w-3xl">
      <div className="overflow-y-auto p-6">
        {/* Título — input grande, sem borda superior/lateral, estilo Material */}
        <div className="border-b border-gray-200 pb-2 dark:border-slate-700">
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Adicionar título"
            className="w-full border-0 bg-transparent py-2 text-lg font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        {/* Tipo: Evento, Tarefa, Lembrete */}
        <div className="mt-4 flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {(
            [
              { id: "evento" as TipoEvento, label: "Evento" },
              { id: "tarefa" as TipoEvento, label: "Tarefa" },
              { id: "lembrete" as TipoEvento, label: "Lembrete" },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTipo(id)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                tipo === id
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100 dark:shadow-none"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Data e Hora + O dia todo */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Calendar className="h-5 w-5 shrink-0" />
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]"
                />
                {!diaTodo && (
                  <input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]"
                  />
                )}
              </div>
              <span className="text-slate-400 dark:text-slate-500">–</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]"
                />
                {!diaTodo && (
                  <input
                    type="time"
                    value={horaFim}
                    onChange={(e) => setHoraFim(e.target.value)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]"
                  />
                )}
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={diaTodo}
                  onChange={(e) => setDiaTodo(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#6D28D9] focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800"
                />
                O dia todo
              </label>
            </div>
          </div>
        </div>

        {/* Convidados */}
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 focus-within:ring-2 focus-within:ring-[#6D28D9]/20 dark:border-slate-600 dark:focus-within:ring-violet-500/30">
          <Users className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={convidados}
            onChange={(e) => setConvidados(e.target.value)}
            placeholder="Adicionar convidados"
            className="flex-1 border-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        {/* Videoconferência Google Meet */}
        <div className="mt-3">
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Video className="h-5 w-5 text-slate-500 dark:text-slate-400" />
            Adicionar videoconferência do Google Meet
          </button>
        </div>

        {/* Local */}
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 focus-within:ring-2 focus-within:ring-[#6D28D9]/20 dark:border-slate-600 dark:focus-within:ring-violet-500/30">
          <MapPin className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Adicionar local"
            className="flex-1 border-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        {/* Descrição / Anexos */}
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2 focus-within:ring-2 focus-within:ring-[#6D28D9]/20 dark:border-slate-600 dark:focus-within:ring-violet-500/30">
          <Paperclip className="mt-2.5 h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" />
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Adicionar descrição ou anexos"
            rows={4}
            className="min-h-[80px] flex-1 resize-y border-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        {/* Ações */}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            className="rounded-lg bg-[#6D28D9] px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
          >
            Salvar
          </button>
        </div>
      </div>
    </DrawerSheet>
  );
}
