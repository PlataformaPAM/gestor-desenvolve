"use client";

import type { LogSistema } from "@/lib/configuracoes/types";

type LogsTableProps = {
  logs: LogSistema[];
};

export function LogsTable({ logs }: LogsTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Data
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Usuário
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Ação
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Módulo
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Detalhes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                  {new Date(log.data).toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {log.usuarioNome || log.usuarioCpf || "—"}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">
                  {log.acao}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {log.modulo ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {log.detalhes ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
