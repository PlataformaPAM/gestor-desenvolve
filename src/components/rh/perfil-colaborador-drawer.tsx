"use client";

import { useState } from "react";
import { User, Users, CreditCard, FileText, TrendingUp, Upload, Link2, FolderOpen } from "lucide-react";
import type { ColaboradorParceiro } from "@/lib/rh/types";
import { TIPO_CONTRATO_LABELS, STATUS_LABELS, iniciais } from "@/lib/rh/constants";
import { formatCurrency } from "@/lib/clientes/utils";
import { PAPEIS_CONTATO_CLIENTE } from "@/lib/clientes/constants";
import clsx from "clsx";

/** Normaliza CPF/CNPJ para comparação (apenas dígitos). */
function cpfNormalizado(val: string | undefined): string {
  if (!val) return "";
  return val.replace(/\D/g, "");
}

type UsuarioResumo = {
  id: string;
  cpf: string;
  email?: string;
  nomeExibicao?: string;
  perfilId?: string;
};

type PerfilColaboradorDrawerProps = {
  colaborador: ColaboradorParceiro | null;
  /** Lista de usuários do módulo Configurações para exibir vínculo de acesso (apenas leitura). */
  usuarios?: UsuarioResumo[];
  onEditarDados?: () => void;
};

type TabDrawer = "dados" | "vinculo" | "arquivos";

export function PerfilColaboradorDrawer({
  colaborador,
  usuarios = [],
  onEditarDados,
}: PerfilColaboradorDrawerProps) {
  const [tab, setTab] = useState<TabDrawer>("dados");

  if (!colaborador) return null;

  const cpfCol = cpfNormalizado(colaborador.cpfCnpj);
  const usuarioVinculado = cpfCol
    ? usuarios.find((u) => cpfNormalizado(u.cpf) === cpfCol)
    : undefined;

  const isVendedor = colaborador.tipo === "vendedor_externo";

  const tabs: { id: TabDrawer; label: string }[] = [
    { id: "dados", label: "Dados" },
    { id: "vinculo", label: "Vínculo de Acesso" },
    { id: "arquivos", label: "Arquivos" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Cabeçalho fixo */}
      <div className="flex items-start gap-4 border-b border-slate-200 p-4 lg:p-6 shrink-0 dark:border-slate-700">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#6D28D9]/10 text-xl font-semibold text-[#6D28D9]">
          {iniciais(colaborador.nome)}
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{colaborador.nome}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{colaborador.cargoOuFuncao}</p>
          <span
            className={clsx(
              "mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
              colaborador.status === "ativo" &&
                "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-500/40",
              colaborador.status === "inativo" &&
                "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-700",
              colaborador.status === "ferias" &&
                "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-500/40",
              colaborador.status === "afastado" &&
                "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-500/40"
            )}
          >
            {STATUS_LABELS[colaborador.status]} · {TIPO_CONTRATO_LABELS[colaborador.tipoContrato]}
          </span>
        </div>
      </div>

      {/* Abas */}
      <nav className="flex gap-1 border-b border-slate-200 px-4 lg:px-6 shrink-0 dark:border-slate-700" aria-label="Abas do perfil">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={clsx(
              "rounded-t-lg border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-[#6D28D9] text-[#6D28D9] dark:border-violet-400/60 dark:text-violet-200"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {tab === "dados" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
              <div className="flex items-center justify-between gap-2 text-slate-700 dark:text-slate-200">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-[#6D28D9]" />
                  <span className="text-sm font-semibold">Informações pessoais e de contrato</span>
                </div>
                <button
                  type="button"
                  onClick={onEditarDados}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Editar dados
                </button>
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                {colaborador.email && (
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">E-mail</dt>
                    <dd>
                      <a
                        href={`mailto:${colaborador.email}`}
                        className="text-[#6D28D9] hover:underline"
                      >
                        {colaborador.email}
                      </a>
                    </dd>
                  </div>
                )}
                {colaborador.telefone && (
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Telefone</dt>
                    <dd>
                      <a href={`tel:${colaborador.telefone}`} className="text-[#6D28D9] hover:underline">
                        {colaborador.telefone}
                      </a>
                    </dd>
                  </div>
                )}
                {colaborador.cpfCnpj && (
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">CPF/CNPJ</dt>
                    <dd className="font-mono text-slate-900 dark:text-slate-100">{colaborador.cpfCnpj}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Tipo de contrato</dt>
                  <dd className="text-slate-900 dark:text-slate-100">
                    {TIPO_CONTRATO_LABELS[colaborador.tipoContrato]}
                  </dd>
                </div>
              </dl>
            </div>

            {colaborador.tipo === "fornecedor_parceiro" && colaborador.contatos && colaborador.contatos.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <Users className="h-5 w-5 text-[#6D28D9]" />
                  <span className="text-sm font-semibold">Contatos</span>
                </div>
                <ul className="mt-3 space-y-3 text-sm">
                  {colaborador.contatos.map((ct) => {
                    const papeisLabels = (ct.papeis ?? [])
                      .map((p) => PAPEIS_CONTATO_CLIENTE.find((o) => o.value === p)?.label)
                      .filter(Boolean);
                    return (
                      <li
                        key={ct.id}
                        className="rounded-lg border border-slate-200 bg-white/80 p-3 dark:border-slate-600 dark:bg-slate-800/80"
                      >
                        <p className="font-medium text-slate-900 dark:text-slate-100">{ct.nome || "—"}</p>
                        <div className="mt-1 space-y-0.5 text-slate-600 dark:text-slate-400">
                          {ct.email && (
                            <p>
                              <a href={`mailto:${ct.email}`} className="text-[#6D28D9] hover:underline">
                                {ct.email}
                              </a>
                            </p>
                          )}
                          {ct.telefone && (
                            <p>
                              <a href={`tel:${ct.telefone}`} className="text-[#6D28D9] hover:underline">
                                {ct.telefone}
                              </a>
                            </p>
                          )}
                          {(ct.setor || ct.cargo) && (
                            <p>
                              {[ct.setor, ct.cargo].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          {papeisLabels.length > 0 && (
                            <p className="text-xs text-slate-500 dark:text-slate-500">
                              Papéis: {papeisLabels.join(", ")}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {colaborador.dadosBancarios && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <CreditCard className="h-5 w-5 text-[#6D28D9]" />
                  <span className="text-sm font-semibold">Dados bancários</span>
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  {colaborador.dadosBancarios.banco && (
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Banco</dt>
                      <dd className="text-slate-900 dark:text-slate-100">{colaborador.dadosBancarios.banco}</dd>
                    </div>
                  )}
                  {colaborador.dadosBancarios.agencia && (
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Agência</dt>
                      <dd className="font-mono text-slate-900 dark:text-slate-100">{colaborador.dadosBancarios.agencia}</dd>
                    </div>
                  )}
                  {colaborador.dadosBancarios.conta && (
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Conta</dt>
                      <dd className="font-mono text-slate-900 dark:text-slate-100">{colaborador.dadosBancarios.conta}</dd>
                    </div>
                  )}
                  {colaborador.dadosBancarios.pix && (
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">PIX</dt>
                      <dd className="font-mono text-slate-900 dark:text-slate-100">{colaborador.dadosBancarios.pix}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {isVendedor && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-500/40 dark:bg-emerald-950/50">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                  <TrendingUp className="h-5 w-5" />
                  <span className="text-sm font-semibold">Performance</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  {colaborador.totalVendasMes != null
                    ? formatCurrency(colaborador.totalVendasMes)
                    : "—"}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-300/80">Total de vendas no mês</p>
              </div>
            )}
          </div>
        )}

        {tab === "vinculo" && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <Link2 className="h-5 w-5 text-[#6D28D9]" />
              <span className="text-sm font-semibold">Usuário no sistema (Configurações)</span>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Apenas visualização: indica se este CPF/CNPJ já possui um usuário criado no módulo Configurações.
            </p>
            {usuarioVinculado ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-500/40 dark:bg-emerald-950/50">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Usuário vinculado</p>
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  {usuarioVinculado.nomeExibicao || usuarioVinculado.email}
                </p>
                {usuarioVinculado.email && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">{usuarioVinculado.email}</p>
                )}
                <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">
                  Perfil ID: {usuarioVinculado.perfilId ?? "—"}
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <p className="text-sm text-slate-600 dark:text-slate-300">Nenhum usuário vinculado a este CPF/CNPJ.</p>
                <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">
                  Crie o usuário em Configurações e vincule à pessoa (RH/Cliente) para liberar acesso.
                </p>
              </div>
            )}
          </div>
        )}

        {tab === "arquivos" && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <FileText className="h-5 w-5 text-[#6D28D9]" />
              <span className="text-sm font-semibold">Documentos e contratos</span>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Área de armazenamento (futura integração com Google Drive) para contratos, RG e outros arquivos.
            </p>
            {colaborador.documentos && colaborador.documentos.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {colaborador.documentos.map((doc, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/50"
                  >
                    <span className="text-slate-700 dark:text-slate-200">{doc.nome}</span>
                    {doc.url && (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#6D28D9] hover:underline"
                      >
                        Abrir
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Nenhum documento anexado.</p>
            )}
            <button
              type="button"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white py-6 text-sm text-slate-600 hover:border-[#6D28D9] hover:bg-violet-50/30 hover:text-[#6D28D9] transition-colors dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-violet-950/30 dark:hover:text-violet-200"
            >
              <Upload className="h-5 w-5" />
              <span>Arraste ou clique para enviar arquivos</span>
            </button>
            <p className="mt-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <FolderOpen className="h-3.5 w-3.5" />
              Contratos, RG e comprovantes (integração Google Drive em breve).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
