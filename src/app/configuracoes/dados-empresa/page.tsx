"use client";

import { useEffect, useState } from "react";
import { ConfiguracoesTopNav } from "@/components/configuracoes/configuracoes-top-nav";
import { Toast } from "@/components/ui/toast";

/** Somente identidade da empresa (variáveis `empresa.*`); layout fica em Papéis Timbrados. */
type DadosEmpresaForm = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  telefone: string;
  email: string;
  site: string;
  endereco: string;
};

const EMPTY: DadosEmpresaForm = {
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  telefone: "",
  email: "",
  site: "",
  endereco: "",
};

export default function DadosEmpresaPage() {
  const [config, setConfig] = useState<DadosEmpresaForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; variant: "success" | "error" }>({
    visible: false,
    message: "",
    variant: "success",
  });

  const showToast = (message: string, variant: "success" | "error" = "success") => {
    setToast({ visible: false, message: "", variant });
    window.requestAnimationFrame(() => setToast({ visible: true, message, variant }));
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/configuracoes/documentos-empresa", { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: { config?: Partial<DadosEmpresaForm> } };
        if (!active || !res.ok || !json.success || !json.data?.config) return;
        const c = json.data.config;
        setConfig((prev) => ({
          ...prev,
          razaoSocial: c.razaoSocial ?? prev.razaoSocial,
          nomeFantasia: c.nomeFantasia ?? prev.nomeFantasia,
          cnpj: c.cnpj ?? prev.cnpj,
          telefone: c.telefone ?? prev.telefone,
          email: c.email ?? prev.email,
          site: c.site ?? prev.site,
          endereco: c.endereco ?? prev.endereco,
        }));
      } catch {
        // noop
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const salvar = () => {
    void (async () => {
      setSaving(true);
      try {
        const res = await fetch("/api/configuracoes/documentos-empresa", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            config: {
              razaoSocial: config.razaoSocial,
              nomeFantasia: config.nomeFantasia,
              cnpj: config.cnpj,
              telefone: config.telefone,
              email: config.email,
              site: config.site,
              endereco: config.endereco,
            },
          }),
        });
        const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
        if (!res.ok || !json.success) {
          showToast(json.error?.message ?? "Não foi possível salvar os dados da empresa.", "error");
          return;
        }
        showToast("Dados da empresa salvos com sucesso.", "success");
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <section className="w-full min-w-0 space-y-4">
      <div className="flex w-full min-w-0 flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Dados da Empresa</h2>
        <ConfiguracoesTopNav
          atalhosDocumentos
          returnHref="/configuracoes/construtor-documentos"
          returnLabel="Voltar ao Construtor"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-900">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Campos padrão usados para variáveis do construtor de documentos (`empresa.*`).
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input value={config.razaoSocial} onChange={(e) => setConfig((p) => ({ ...p, razaoSocial: e.target.value }))} placeholder="Razão social" className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
          <input value={config.nomeFantasia} onChange={(e) => setConfig((p) => ({ ...p, nomeFantasia: e.target.value }))} placeholder="Nome fantasia" className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
          <input value={config.cnpj} onChange={(e) => setConfig((p) => ({ ...p, cnpj: e.target.value }))} placeholder="CNPJ" className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
          <input value={config.telefone} onChange={(e) => setConfig((p) => ({ ...p, telefone: e.target.value }))} placeholder="Telefone" className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
          <input value={config.email} onChange={(e) => setConfig((p) => ({ ...p, email: e.target.value }))} placeholder="E-mail" className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
          <input value={config.site} onChange={(e) => setConfig((p) => ({ ...p, site: e.target.value }))} placeholder="Site" className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
          <input value={config.endereco} onChange={(e) => setConfig((p) => ({ ...p, endereco: e.target.value }))} placeholder="Endereço completo" className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 lg:col-span-3" />
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" disabled={saving} onClick={salvar} className="rounded-lg bg-[#6D28D9] px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60">
            {saving ? "Salvando..." : "Salvar dados da empresa"}
          </button>
        </div>
      </div>
      <Toast
        visible={toast.visible}
        message={toast.message}
        variant={toast.variant}
        duration={toast.variant === "error" ? 7000 : 3000}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </section>
  );
}

