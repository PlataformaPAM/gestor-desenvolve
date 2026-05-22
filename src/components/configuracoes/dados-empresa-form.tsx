"use client";

import { useEffect, useState } from "react";
import { Toast } from "@/components/ui/toast";
import {
  formModalCancelButtonClass,
  formInputClass,
  formLabelClass,
  formModalSubmitButtonClass,
} from "@/components/ui/field-patterns";
import {
  Building2,
  Landmark,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Globe,
  Hash,
  Building,
  Map,
  Save,
  X,
} from "lucide-react";

type DadosEmpresaForm = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  telefone: string;
  email: string;
  site: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  endereco: string;
};

const EMPTY: DadosEmpresaForm = {
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  telefone: "",
  email: "",
  site: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  endereco: "",
};

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function parseEndereco(endereco: string): Pick<DadosEmpresaForm, "logradouro" | "numero" | "complemento" | "bairro" | "cidade" | "uf"> {
  if (!endereco.trim()) {
    return {
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      uf: "",
    };
  }

  const [streetPart, bairroPart = "", cidadeUfPart = ""] = endereco.split(" - ");
  const [logradouro = "", numero = "", complemento = ""] = streetPart.split(", ");
  const [cidade = "", uf = ""] = cidadeUfPart.split("/");
  return {
    logradouro: logradouro.trim(),
    numero: numero.trim(),
    complemento: complemento.trim(),
    bairro: bairroPart.trim(),
    cidade: cidade.trim(),
    uf: uf.trim(),
  };
}

function composeEndereco(config: DadosEmpresaForm): string {
  const street = [config.logradouro, config.numero, config.complemento]
    .map((v) => v.trim())
    .filter(Boolean)
    .join(", ");
  const bairro = config.bairro.trim();
  const cidadeUf = [config.cidade.trim(), config.uf.trim()].filter(Boolean).join("/");
  return [street, bairro, cidadeUf].filter(Boolean).join(" - ");
}

export function DadosEmpresaFormSection({
  compact = false,
  withFixedFooter = false,
  onCancel,
  onSaved,
  permitirSalvar = true,
}: {
  compact?: boolean;
  withFixedFooter?: boolean;
  onCancel?: () => void;
  onSaved?: () => void;
  permitirSalvar?: boolean;
}) {
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
        const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: { config?: Record<string, unknown> } };
        if (!active || !res.ok || !json.success || !json.data?.config) return;
        const c = json.data.config;
        const enderecoRaw = asString(c.endereco);
        const parsedEndereco = parseEndereco(enderecoRaw);

        setConfig((prev) => ({
          ...prev,
          razaoSocial: asString(c.razaoSocial) || prev.razaoSocial,
          nomeFantasia: asString(c.nomeFantasia) || prev.nomeFantasia,
          cnpj: asString(c.cnpj) || prev.cnpj,
          telefone: asString(c.telefone) || prev.telefone,
          email: asString(c.email) || prev.email,
          site: asString(c.site) || prev.site,
          cep: asString(c.cep) || prev.cep,
          logradouro: asString(c.logradouro) || (enderecoRaw ? parsedEndereco.logradouro : prev.logradouro),
          numero: asString(c.numero) || (enderecoRaw ? parsedEndereco.numero : prev.numero),
          complemento: asString(c.complemento) || (enderecoRaw ? parsedEndereco.complemento : prev.complemento),
          bairro: asString(c.bairro) || (enderecoRaw ? parsedEndereco.bairro : prev.bairro),
          cidade: asString(c.cidade) || (enderecoRaw ? parsedEndereco.cidade : prev.cidade),
          uf: asString(c.uf) || (enderecoRaw ? parsedEndereco.uf : prev.uf),
          endereco: enderecoRaw || prev.endereco,
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
              cep: config.cep,
              logradouro: config.logradouro,
              numero: config.numero,
              complemento: config.complemento,
              bairro: config.bairro,
              cidade: config.cidade,
              uf: config.uf,
              endereco: composeEndereco(config),
            },
          }),
        });
        const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
        if (!res.ok || !json.success) {
          showToast(json.error?.message ?? "Não foi possível salvar os dados da empresa.", "error");
          return;
        }
        showToast("Dados da empresa salvos com sucesso.", "success");
        if (onSaved) {
          window.setTimeout(() => {
            onSaved();
          }, 900);
        }
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <>
      <div
        className={
          withFixedFooter
            ? "flex min-h-0 flex-1 flex-col"
            : compact
              ? ""
              : "rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-900 lg:p-6"
        }
      >
        <div className={withFixedFooter ? "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6" : ""}>
          <div className="mt-1 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1 sm:col-span-2 lg:col-span-4">
            <label className={formLabelClass}>Razão social</label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={config.razaoSocial ?? ""} onChange={(e) => setConfig((p) => ({ ...p, razaoSocial: e.target.value }))} placeholder="Ex.: Desenvolve Soluções LTDA" className={`${formInputClass} pl-9`} />
            </div>
          </div>
          <div className="space-y-1 sm:col-span-2 lg:col-span-4">
            <label className={formLabelClass}>Nome fantasia</label>
            <div className="relative">
              <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={config.nomeFantasia ?? ""} onChange={(e) => setConfig((p) => ({ ...p, nomeFantasia: e.target.value }))} placeholder="Ex.: Gestor Desenvolve" className={`${formInputClass} pl-9`} />
            </div>
          </div>
          <div className="space-y-1 sm:col-span-1 lg:col-span-2">
            <label className={formLabelClass}>CNPJ</label>
            <div className="relative">
              <Landmark className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={config.cnpj ?? ""} onChange={(e) => setConfig((p) => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" className={`${formInputClass} pl-9`} />
            </div>
          </div>
          <div className="space-y-1 sm:col-span-1 lg:col-span-2">
            <label className={formLabelClass}>Telefone</label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={config.telefone ?? ""} onChange={(e) => setConfig((p) => ({ ...p, telefone: e.target.value }))} placeholder="(00) 00000-0000" className={`${formInputClass} pl-9`} />
            </div>
          </div>
          <div className="space-y-1 sm:col-span-1 lg:col-span-2">
            <label className={formLabelClass}>E-mail</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={config.email ?? ""} onChange={(e) => setConfig((p) => ({ ...p, email: e.target.value }))} placeholder="contato@empresa.com" className={`${formInputClass} pl-9`} />
            </div>
          </div>
          <div className="space-y-1 sm:col-span-1 lg:col-span-2">
            <label className={formLabelClass}>Site</label>
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={config.site ?? ""} onChange={(e) => setConfig((p) => ({ ...p, site: e.target.value }))} placeholder="https://empresa.com.br" className={`${formInputClass} pl-9`} />
            </div>
          </div>
          <div className="space-y-1 sm:col-span-1 lg:col-span-1">
            <label className={formLabelClass}>CEP</label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={config.cep ?? ""} onChange={(e) => setConfig((p) => ({ ...p, cep: e.target.value }))} placeholder="00000-000" className={`${formInputClass} pl-9`} />
            </div>
          </div>
          <div className="space-y-1 sm:col-span-1 lg:col-span-3">
            <label className={formLabelClass}>Logradouro</label>
            <div className="relative">
              <Map className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={config.logradouro ?? ""} onChange={(e) => setConfig((p) => ({ ...p, logradouro: e.target.value }))} placeholder="Rua / Avenida" className={`${formInputClass} pl-9`} />
            </div>
          </div>
          <div className="space-y-1 sm:col-span-1 lg:col-span-2">
            <label className={formLabelClass}>Número</label>
            <div className="relative">
              <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={config.numero ?? ""} onChange={(e) => setConfig((p) => ({ ...p, numero: e.target.value }))} placeholder="Nº" className={`${formInputClass} pl-9`} />
            </div>
          </div>
          <div className="space-y-1 sm:col-span-1 lg:col-span-2">
            <label className={formLabelClass}>Complemento</label>
            <div className="relative">
              <Building className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={config.complemento ?? ""} onChange={(e) => setConfig((p) => ({ ...p, complemento: e.target.value }))} placeholder="Sala, bloco, andar..." className={`${formInputClass} pl-9`} />
            </div>
          </div>
          <div className="space-y-1 sm:col-span-1 lg:col-span-2">
            <label className={formLabelClass}>Bairro</label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={config.bairro ?? ""} onChange={(e) => setConfig((p) => ({ ...p, bairro: e.target.value }))} placeholder="Bairro" className={`${formInputClass} pl-9`} />
            </div>
          </div>
          <div className="space-y-1 sm:col-span-1 lg:col-span-1">
            <label className={formLabelClass}>Cidade</label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={config.cidade ?? ""} onChange={(e) => setConfig((p) => ({ ...p, cidade: e.target.value }))} placeholder="Cidade" className={`${formInputClass} pl-9`} />
            </div>
          </div>
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <label className={formLabelClass}>UF</label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={config.uf ?? ""} onChange={(e) => setConfig((p) => ({ ...p, uf: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="UF" className={`${formInputClass} pl-9 uppercase`} />
            </div>
          </div>
          </div>
        </div>
        <div
          className={
            withFixedFooter
              ? "flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:justify-end sm:gap-3 sm:px-6"
              : "mt-4 flex justify-end"
          }
        >
          {withFixedFooter ? (
            <button type="button" onClick={onCancel} className={formModalCancelButtonClass}>
              <span className="inline-flex items-center gap-2">
                <X className="h-4 w-4 shrink-0" aria-hidden />
                Cancelar
              </span>
            </button>
          ) : null}
          {permitirSalvar ? (
            <button type="button" disabled={saving} onClick={salvar} className={formModalSubmitButtonClass}>
              <span className="inline-flex items-center gap-2">
                <Save className="h-4 w-4 shrink-0" aria-hidden />
                {saving ? "Salvando..." : "Salvar"}
              </span>
            </button>
          ) : null}
        </div>
      </div>
      <Toast
        visible={toast.visible}
        message={toast.message}
        variant={toast.variant}
        duration={toast.variant === "error" ? 7000 : 3000}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </>
  );
}
