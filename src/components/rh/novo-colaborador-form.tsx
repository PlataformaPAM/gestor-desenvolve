"use client";

import { useCallback, useEffect, useId, useRef, useState, type ComponentType } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  Plus,
  Trash2,
  User,
  Handshake,
  FileText,
  CreditCard,
  Mail,
  Phone,
  ShieldCheck,
  UserRoundCheck,
  BriefcaseBusiness,
  Clock3,
  CircleSlash2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  Save,
  BadgePercent,
  Landmark,
} from "lucide-react";
import type { ColaboradorParceiro, TipoPessoaRH, TipoContrato } from "@/lib/rh/types";
import type { Contato, PapelContatoCliente } from "@/lib/clientes/types";
import {
  TIPO_CONTRATO_LABELS,
  TIPO_CONTRATO_OPCOES_CONSULTOR,
  TIPO_CONTRATO_OPCOES_FORNECEDOR,
} from "@/lib/rh/constants";
import { isConsultorPreCadastro, RH_CONSULTOR_PRE_CADASTRO_CARGO } from "@/lib/rh/pre-cadastro-consultor";
import { PAPEIS_CONTATO_CLIENTE } from "@/lib/clientes/constants";
import { fetchCnpjBrasilApi } from "@/lib/clientes/brasilapi-cnpj";
import { formatBrazilianPhoneInput } from "@/lib/comercial/phone-input";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import {
  formInputClass,
  formLabelClass,
  formModalCancelButtonClass,
  formModalSubmitButtonClass,
} from "@/components/ui/field-patterns";
import { ConsultorComissoesPanel } from "@/components/rh/consultor-comissoes-panel";

/** Tipos de contrato permitidos para Equipe (persistidos no enum Prisma). */
const TIPO_CONTRATO_EQUIPE: TipoContrato[] = ["clt", "pj", "estagio", "socio"];

export type NovoColaboradorPayload = Omit<ColaboradorParceiro, "id">;

type TabRhB2b = "dados" | "contatos" | "comissoes";

type NovoColaboradorFormProps = {
  /** `id` pode vir do registro ao editar (usado só para não disparar consulta CNPJ). */
  initialValues?: (Partial<NovoColaboradorPayload> & { id?: string }) | null;
  /** Aba atual do RH ao criar (ex.: fornecedor_parceiro na aba Fornecedores). */
  defaultTipo?: TipoPessoaRH;
  /** Se true, o tipo fica fixo (ex.: criação pela aba Fornecedores). */
  lockTipo?: boolean;
  onSave: (payload: NovoColaboradorPayload) => void;
  onCancel: () => void;
  /** Quando false, oculta o botão Salvar (somente visualização). */
  permitirSalvar?: boolean;
};

function tipoContratoInicial(
  iv: NovoColaboradorFormProps["initialValues"],
  defaultTipo: TipoPessoaRH | undefined
): TipoContrato {
  if (iv?.tipoContrato) return iv.tipoContrato;
  if (defaultTipo === "fornecedor_parceiro") return "fornecedor";
  if (defaultTipo === "vendedor_externo") return "consultor";
  return "clt";
}

const inputClass = formInputClass;
const labelClass = formLabelClass;
type TipoContratoUi = TipoContrato | "mentor" | "tecnico" | "temporario";

function toPersistTipoContrato(value: TipoContratoUi): TipoContrato {
  if (value === "mentor") return "consultor";
  if (value === "tecnico") return "especialista";
  /** Legado UI: “Temporário” mapeava para PJ; mantido para não quebrar registros antigos ao editar. */
  if (value === "temporario") return "pj";
  return value;
}

function coloredIcon(Icon: ComponentType<{ className?: string }>, color: string) {
  function ColoredIcon({ className }: { className?: string }) {
    return <Icon className={clsx(className, color)} />;
  }
  const name = Icon.displayName ?? Icon.name ?? "Icon";
  ColoredIcon.displayName = `Colored(${name})`;
  return ColoredIcon;
}

const STATUS_OPTIONS: SearchableOption[] = [
  { value: "ativo", label: "Ativo", icon: coloredIcon(ShieldCheck, "!text-emerald-600 dark:!text-emerald-400") },
  { value: "afastado", label: "Afastado", icon: coloredIcon(CircleSlash2, "!text-red-600 dark:!text-red-400") },
  { value: "ferias", label: "Férias", icon: coloredIcon(UserRoundCheck, "!text-sky-600 dark:!text-sky-400") },
  { value: "inativo", label: "Inativo", icon: coloredIcon(Clock3, "!text-slate-500 dark:!text-slate-300") },
];

const CONTRATO_OPTIONS_EQUIPE: SearchableOption[] = [
  { value: "clt", label: "CLT", icon: coloredIcon(BriefcaseBusiness, "!text-indigo-600 dark:!text-indigo-400") },
  {
    value: "pj",
    label: TIPO_CONTRATO_LABELS.pj,
    icon: coloredIcon(Landmark, "!text-blue-700 dark:!text-blue-300"),
  },
  { value: "estagio", label: "Estágio", icon: coloredIcon(UserRoundCheck, "!text-amber-600 dark:!text-amber-400") },
  { value: "mentor", label: "Mentor", icon: coloredIcon(Handshake, "!text-violet-600 dark:!text-violet-400") },
  { value: "socio", label: "Sócio", icon: coloredIcon(ShieldCheck, "!text-emerald-600 dark:!text-emerald-400") },
  { value: "tecnico", label: "Técnico", icon: coloredIcon(FileText, "!text-cyan-600 dark:!text-cyan-400") },
  { value: "temporario", label: "Temporário", icon: coloredIcon(Clock3, "!text-orange-600 dark:!text-orange-400") },
];

const CONTRATO_OPTIONS_B2B: SearchableOption[] = [
  { value: "consultor", label: TIPO_CONTRATO_LABELS.consultor, icon: coloredIcon(Handshake, "!text-violet-600 dark:!text-violet-400") },
  { value: "especialista", label: TIPO_CONTRATO_LABELS.especialista, icon: coloredIcon(FileText, "!text-cyan-600 dark:!text-cyan-400") },
  {
    value: "pj",
    label: TIPO_CONTRATO_LABELS.pj,
    icon: coloredIcon(Landmark, "!text-blue-700 dark:!text-blue-300"),
  },
  { value: "estagio", label: "Estágio", icon: coloredIcon(UserRoundCheck, "!text-amber-600 dark:!text-amber-400") },
  { value: "fornecedor", label: TIPO_CONTRATO_LABELS.fornecedor, icon: coloredIcon(Building2, "!text-emerald-600 dark:!text-emerald-400") },
  { value: "mentor", label: "Mentor", icon: coloredIcon(UserRoundCheck, "!text-emerald-600 dark:!text-emerald-400") },
  { value: "parceiro", label: TIPO_CONTRATO_LABELS.parceiro, icon: coloredIcon(Users, "!text-fuchsia-600 dark:!text-fuchsia-400") },
  { value: "prestador_servico", label: TIPO_CONTRATO_LABELS.prestador_servico, icon: coloredIcon(BriefcaseBusiness, "!text-indigo-600 dark:!text-indigo-400") },
  { value: "profissional_liberal", label: TIPO_CONTRATO_LABELS.profissional_liberal, icon: coloredIcon(User, "!text-sky-600 dark:!text-sky-400") },
  { value: "tecnico", label: "Técnico", icon: coloredIcon(FileText, "!text-cyan-600 dark:!text-cyan-400") },
  { value: "temporario", label: "Temporário", icon: coloredIcon(Clock3, "!text-orange-600 dark:!text-orange-400") },
  { value: "vendedor", label: TIPO_CONTRATO_LABELS.vendedor, icon: coloredIcon(Users, "!text-pink-600 dark:!text-pink-400") },
];

function maskCpfDigits(d: string): string {
  const x = d.slice(0, 11);
  if (x.length <= 3) return x;
  if (x.length <= 6) return `${x.slice(0, 3)}.${x.slice(3)}`;
  if (x.length <= 9) return `${x.slice(0, 3)}.${x.slice(3, 6)}.${x.slice(6)}`;
  return `${x.slice(0, 3)}.${x.slice(3, 6)}.${x.slice(6, 9)}-${x.slice(9)}`;
}

function maskCnpjDigits(d: string): string {
  const v = d.slice(0, 14);
  if (v.length <= 2) return v;
  if (v.length <= 5) return `${v.slice(0, 2)}.${v.slice(2)}`;
  if (v.length <= 8) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5)}`;
  if (v.length <= 12) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8)}`;
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12, 14)}`;
}

function formatCpfCnpjInput(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) return maskCpfDigits(d);
  return maskCnpjDigits(d);
}

const emptyContato = (): Contato => ({
  id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  nome: "",
  email: "",
  telefone: "",
  setor: "",
  cargo: "",
  papeis: [],
});

function AutoFillInput({
  className,
  justFilled,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { justFilled?: boolean }) {
  return (
    <input
      className={clsx(
        inputClass,
        justFilled && "border-emerald-500 ring-2 ring-emerald-400/50 ring-offset-1",
        className
      )}
      {...props}
    />
  );
}

export function NovoColaboradorForm({
  initialValues,
  defaultTipo,
  lockTipo = false,
  onSave,
  onCancel,
  permitirSalvar = true,
}: NovoColaboradorFormProps) {
  const fornecedorTabListId = useId();

  const [nome, setNome] = useState(initialValues?.nome ?? "");
  const [cargoOuFuncao, setCargoOuFuncao] = useState(initialValues?.cargoOuFuncao ?? "");
  const [cpfCnpj, setCpfCnpj] = useState(initialValues?.cpfCnpj ?? "");
  const [tipo, setTipo] = useState<TipoPessoaRH>(
    initialValues?.tipo ?? defaultTipo ?? "equipe_interna"
  );
  const [tipoContrato, setTipoContrato] = useState<TipoContratoUi>(() =>
    tipoContratoInicial(initialValues, defaultTipo) as TipoContratoUi
  );
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [telefone, setTelefone] = useState(() => formatBrazilianPhoneInput(initialValues?.telefone ?? ""));
  const [status, setStatus] = useState<ColaboradorParceiro["status"]>(initialValues?.status ?? "ativo");

  const [activeTab, setActiveTab] = useState<TabRhB2b>("dados");
  const [expandedContatoId, setExpandedContatoId] = useState<string | null>(null);
  const [contatos, setContatos] = useState<Contato[]>(() => {
    const t = initialValues?.tipo ?? defaultTipo ?? "equipe_interna";
    if (
      (t === "fornecedor_parceiro" || t === "vendedor_externo") &&
      initialValues?.contatos?.length
    ) {
      return initialValues.contatos.map((c) => ({
        ...c,
        papeis: c.papeis ?? [],
        telefone: formatBrazilianPhoneInput(c.telefone ?? ""),
      }));
    }
    return [];
  });
  const [contatoIdParaRemover, setContatoIdParaRemover] = useState<string | null>(null);
  /** Criação na aba Consultores: começa só com Nome + Tipo (pré); expandir mostra o formulário B2B completo. */
  const [consultorMostrarCadastroCompleto, setConsultorMostrarCadastroCompleto] = useState(false);
  const [efetivarCadastro, setEfetivarCadastro] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [flashCnpj, setFlashCnpj] = useState(false);
  const lastFetchedCnpjRef = useRef<string>("");

  const isFornecedor = tipo === "fornecedor_parceiro";
  const isConsultor = tipo === "vendedor_externo";
  const editingConsultorPre =
    Boolean(initialValues?.id) &&
    isConsultor &&
    isConsultorPreCadastro({
      tipo: (initialValues?.tipo ?? "equipe_interna") as TipoPessoaRH,
      cadastroEfetivado: initialValues?.cadastroEfetivado,
      cargoOuFuncao: initialValues?.cargoOuFuncao,
    });
  const criacaoConsultorMinima =
    !initialValues?.id && lockTipo && defaultTipo === "vendedor_externo" && !consultorMostrarCadastroCompleto;
  const isB2bTabs = isFornecedor || isConsultor;
  const isEquipeInterna = tipo === "equipe_interna";
  const docDigits = cpfCnpj.replace(/\D/g, "");
  const isCnpj = docDigits.length === 14;
  const mostrarAbaContatos = isB2bTabs && isCnpj;
  const mostrarAbaComissoes = (isConsultor || isEquipeInterna) && Boolean(initialValues?.id);
  const opcoesContratoB2b = isFornecedor
    ? CONTRATO_OPTIONS_B2B.filter((o) => [...TIPO_CONTRATO_OPCOES_FORNECEDOR, "mentor", "tecnico", "estagio", "temporario"].includes(String(o.value) as TipoContratoUi))
    : CONTRATO_OPTIONS_B2B.filter((o) => [...TIPO_CONTRATO_OPCOES_CONSULTOR, "mentor", "tecnico", "estagio", "temporario"].includes(String(o.value) as TipoContratoUi));

  useEffect(() => {
    if (lockTipo && defaultTipo) setTipo(defaultTipo);
  }, [lockTipo, defaultTipo]);

  useEffect(() => {
    setEfetivarCadastro(false);
    setNome(initialValues?.nome ?? "");
    setCargoOuFuncao(
      initialValues?.cargoOuFuncao === RH_CONSULTOR_PRE_CADASTRO_CARGO ? "" : (initialValues?.cargoOuFuncao ?? "")
    );
    setCpfCnpj(initialValues?.cpfCnpj ?? "");
    setTipo(initialValues?.tipo ?? defaultTipo ?? "equipe_interna");
    setTipoContrato(tipoContratoInicial(initialValues, defaultTipo) as TipoContratoUi);
    setEmail(initialValues?.email ?? "");
    setTelefone(formatBrazilianPhoneInput(initialValues?.telefone ?? ""));
    setStatus(initialValues?.status ?? "ativo");
    lastFetchedCnpjRef.current = "";
    if (initialValues?.tipo === "fornecedor_parceiro" || initialValues?.tipo === "vendedor_externo") {
      setContatos(
        initialValues.contatos?.length
          ? initialValues.contatos.map((c) => ({
              ...c,
              papeis: c.papeis ?? [],
              telefone: formatBrazilianPhoneInput(c.telefone ?? ""),
            }))
          : []
      );
      setActiveTab("dados");
    } else {
      setContatos([]);
      if (initialValues?.tipo === "equipe_interna") setActiveTab("dados");
    }
  }, [initialValues, defaultTipo]);

  useEffect(() => {
    if (!isEquipeInterna) return;
    if (!TIPO_CONTRATO_EQUIPE.includes(toPersistTipoContrato(tipoContrato))) {
      setTipoContrato("clt");
    }
  }, [isEquipeInterna, tipoContrato]);

  useEffect(() => {
    if (!isB2bTabs) return;
    const allowedBase = isFornecedor ? TIPO_CONTRATO_OPCOES_FORNECEDOR : TIPO_CONTRATO_OPCOES_CONSULTOR;
    const allowed = new Set<TipoContratoUi>([...allowedBase, "mentor", "tecnico", "estagio", "temporario"]);
    setTipoContrato((prev) => (allowed.has(prev) ? prev : (allowedBase[0] as TipoContratoUi)));
  }, [isB2bTabs, isFornecedor, tipo]);

  const fetchByCnpj = useCallback(async (digits: string, cargoPadrao: string) => {
    if (digits.length !== 14) return;
    setLoadingCnpj(true);
    try {
      const res = await fetchCnpjBrasilApi(digits);
      if (res) {
        setNome(res.nomeFantasia?.trim() || res.empresa || "");
        setCargoOuFuncao((prev) => (prev.trim() ? prev : cargoPadrao));
        if (res.telefone) setTelefone(formatBrazilianPhoneInput(res.telefone));
        if (res.email) setEmail(res.email);
        setFlashCnpj(true);
        setTimeout(() => setFlashCnpj(false), 2000);
      }
    } finally {
      setLoadingCnpj(false);
    }
  }, []);

  /** Consulta automática só na criação; em edição não sobrescreve dados ao alterar o CNPJ. */
  useEffect(() => {
    if (!isB2bTabs || initialValues?.id) return;
    if (docDigits.length === 14 && docDigits !== lastFetchedCnpjRef.current) {
      lastFetchedCnpjRef.current = docDigits;
      const cargoPadrao = isFornecedor ? "Fornecedor" : "Consultor";
      setActiveTab("dados");
      void fetchByCnpj(docDigits, cargoPadrao);
    }
    if (docDigits.length < 14) lastFetchedCnpjRef.current = "";
  }, [isB2bTabs, isFornecedor, initialValues?.id, docDigits, fetchByCnpj]);

  useEffect(() => {
    if (activeTab === "contatos" && !mostrarAbaContatos) setActiveTab("dados");
    if (activeTab === "comissoes" && !mostrarAbaComissoes) setActiveTab("dados");
  }, [mostrarAbaContatos, mostrarAbaComissoes, activeTab]);

  useEffect(() => {
    if (!expandedContatoId) return;
    if (!contatos.some((c) => c.id === expandedContatoId)) {
      setExpandedContatoId(null);
    }
  }, [contatos, expandedContatoId]);

  const updateContato = (contatoId: string, patch: Partial<Contato>) => {
    setContatos((prev) => prev.map((c) => (c.id === contatoId ? { ...c, ...patch } : c)));
  };
  const removeContato = (contatoId: string) => {
    setContatos((prev) => prev.filter((c) => c.id !== contatoId));
  };
  const togglePapel = (contatoId: string, papel: PapelContatoCliente) => {
    setContatos((prev) =>
      prev.map((c) => {
        if (c.id !== contatoId) return c;
        const papeis = c.papeis ?? [];
        const next = papeis.includes(papel) ? papeis.filter((p) => p !== papel) : [...papeis, papel];
        return { ...c, papeis: next };
      })
    );
  };

  const contatoRemocaoNome =
    contatoIdParaRemover ? contatos.find((c) => c.id === contatoIdParaRemover)?.nome.trim() || "este contato" : "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (criacaoConsultorMinima) {
      if (!nome.trim()) return;
      onSave({
        nome: nome.trim(),
        tipo: "vendedor_externo",
        tipoContrato: toPersistTipoContrato(tipoContrato),
        status: "ativo",
        cargoOuFuncao: RH_CONSULTOR_PRE_CADASTRO_CARGO,
        cadastroEfetivado: false,
      });
      return;
    }

    const isPreRow =
      Boolean(initialValues?.id) &&
      isConsultorPreCadastro({
        tipo: (initialValues?.tipo ?? "equipe_interna") as TipoPessoaRH,
        cadastroEfetivado: initialValues?.cadastroEfetivado,
        cargoOuFuncao: initialValues?.cargoOuFuncao,
      });

    if (isPreRow && !efetivarCadastro) {
      if (!nome.trim()) return;
      const contatosSavePre = contatos
        .filter((c) => c.nome.trim() || c.email.trim() || c.telefone.trim())
        .map((c) => ({ ...c, papeis: c.papeis ?? [] }));
      onSave({
        nome: nome.trim(),
        cargoOuFuncao: cargoOuFuncao.trim() || RH_CONSULTOR_PRE_CADASTRO_CARGO,
        cpfCnpj: cpfCnpj.trim() || undefined,
        tipo,
        tipoContrato: toPersistTipoContrato(tipoContrato),
        status,
        cadastroEfetivado: false,
        email: email.trim() || undefined,
        telefone: telefone.trim() || undefined,
        contatos: contatosSavePre.length ? contatosSavePre : undefined,
      });
      return;
    }

    if (!nome.trim() || !cargoOuFuncao.trim() || !cpfCnpj.trim()) return;
    if (isEquipeInterna && docDigits.length !== 11) {
      alert("Informe um CPF válido (11 dígitos).");
      return;
    }

    const base: NovoColaboradorPayload = {
      nome: nome.trim(),
      cargoOuFuncao: cargoOuFuncao.trim(),
      cpfCnpj: cpfCnpj.trim(),
      tipo,
      tipoContrato: toPersistTipoContrato(tipoContrato),
      status,
      email: email.trim() || undefined,
      ...(isConsultor ? { cadastroEfetivado: true } : {}),
    };

    if (isB2bTabs) {
      const contatosSave = contatos
        .filter((c) => c.nome.trim() || c.email.trim() || c.telefone.trim())
        .map((c) => ({ ...c, papeis: c.papeis ?? [] }));
      if (isCnpj && contatosSave.length === 0) {
        const rotulo = isFornecedor ? "Fornecedor" : "Consultor";
        alert(`${rotulo} pessoa jurídica (CNPJ): inclua pelo menos um contato na aba Contatos.`);
        setActiveTab("contatos");
        return;
      }
      onSave({
        ...base,
        telefone: telefone.trim() || undefined,
        contatos: contatosSave.length ? contatosSave : undefined,
      });
      return;
    }

    onSave({
      ...base,
      ...(isEquipeInterna
        ? { telefone: telefone.replace(/\D/g, "").length > 0 ? telefone.trim() : undefined }
        : {}),
    });
  };

  const tabsB2b: { id: TabRhB2b; label: string; icon: typeof Building2 }[] = [
    { id: "dados", label: "Dados", icon: isFornecedor ? Building2 : Handshake },
    ...(mostrarAbaContatos ? [{ id: "contatos" as const, label: "Contatos", icon: Users }] : []),
    ...(mostrarAbaComissoes ? [{ id: "comissoes" as const, label: "Comissões", icon: BadgePercent }] : []),
  ];
  const mostrarBarraAbas = tabsB2b.length > 1;

  if (criacaoConsultorMinima) {
    return (
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 lg:p-6">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Você está fazendo um pré-cadastro, para já inserir dados reais e realizar o cadastro completo utilize o
            botão abaixo <span className="font-semibold text-slate-800 dark:text-slate-100">“Efetuar cadastro completo”</span>.
          </p>
          <div>
            <label htmlFor="rh-consultor-pre-nome" className={labelClass}>
              Nome <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <div className="relative">
              <Handshake className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="rh-consultor-pre-nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do consultor"
                className={`${inputClass} pl-9`}
                required
                autoComplete="name"
              />
            </div>
          </div>
          <div>
            <label htmlFor="rh-consultor-pre-contrato" className={labelClass}>
              Tipo de contrato <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <SearchableSelect
              options={[...opcoesContratoB2b].sort((a, b) =>
                a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" })
              )}
              value={tipoContrato}
              onChange={(v) => setTipoContrato(v as TipoContratoUi)}
              searchPlaceholder="Buscar tipo..."
              placeholder="Selecione o tipo"
              leadingIcon={BriefcaseBusiness}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setConsultorMostrarCadastroCompleto(true)}
              className={formModalCancelButtonClass}
            >
              <span className="inline-flex items-center gap-2">
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                Efetuar cadastro completo
              </span>
            </button>
          </div>
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:justify-end sm:gap-3 lg:px-6">
          <button type="button" onClick={onCancel} className={formModalCancelButtonClass}>
            <span className="inline-flex items-center gap-2">
              <X className="h-4 w-4 shrink-0" aria-hidden />
              Cancelar
            </span>
          </button>
          {permitirSalvar ? (
            <button type="submit" className={formModalSubmitButtonClass}>
              <span className="inline-flex items-center gap-2">
                <Save className="h-4 w-4 shrink-0" aria-hidden />
                Salvar
              </span>
            </button>
          ) : null}
        </div>
      </form>
    );
  }

  if (isB2bTabs) {
    return (
      <>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {mostrarBarraAbas && (
            <div
              role="tablist"
              aria-label="Seções do cadastro"
              className="sticky top-0 z-30 flex flex-wrap border-b border-slate-200 bg-slate-50/95 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/95"
            >
              {tabsB2b.map((t) => {
                const Icon = t.icon;
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    id={`${fornecedorTabListId}-tab-${t.id}`}
                    aria-selected={isActive}
                    aria-controls={`${fornecedorTabListId}-${t.id}-panel`}
                    onClick={() => setActiveTab(t.id)}
                    className={clsx(
                      "relative flex min-w-0 flex-1 items-center justify-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors sm:px-4",
                      isActive
                        ? "text-[#6D28D9] dark:text-violet-400"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId={`rh-fornecedor-form-tab-${fornecedorTabListId}`}
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6D28D9]"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                      />
                    )}
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 lg:p-6">
            {activeTab === "dados" && (
              <div
                id={`${fornecedorTabListId}-dados-panel`}
                role="tabpanel"
                aria-labelledby={`${fornecedorTabListId}-tab-dados`}
                className="space-y-4"
              >
                {editingConsultorPre && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100">
                    <p className="font-medium">Pré-cadastro (indicação)</p>
                    <p className="mt-1 text-amber-900/90 dark:text-amber-200/90">
                      Pode atualizar nome e tipo de contrato. Quando o acordo estiver fechado, marque a opção abaixo e
                      preencha os dados obrigatórios para efetivar o cadastro.
                    </p>
                    <label className="mt-3 flex cursor-pointer items-start gap-2 font-medium text-amber-950 dark:text-amber-50">
                      <input
                        type="checkbox"
                        checked={efetivarCadastro}
                        onChange={(e) => setEfetivarCadastro(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-amber-400 text-[#6D28D9] focus:ring-[#6D28D9]"
                      />
                      <span>Efetivar cadastro (contrato/acordo fechado)</span>
                    </label>
                  </div>
                )}
                <div>
                  <label htmlFor="rh-forn-doc" className={labelClass}>
                    CPF/CNPJ{" "}
                    {editingConsultorPre && !efetivarCadastro ? (
                      <span className="font-normal text-slate-500 dark:text-slate-400">(opcional até efetivar)</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">*</span>
                    )}{" "}
                    {loadingCnpj && <span className="font-normal text-slate-500">(consultando…)</span>}
                  </label>
                  <div className="relative">
                    <CreditCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <AutoFillInput
                      id="rh-forn-doc"
                      justFilled={flashCnpj}
                      value={cpfCnpj}
                      onChange={(e) => setCpfCnpj(formatCpfCnpjInput(e.target.value))}
                      placeholder="CPF ou CNPJ"
                      required={!editingConsultorPre || efetivarCadastro}
                      autoComplete="off"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="rh-forn-nome" className={labelClass}>
                    Nome / Razão social <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <div className="relative">
                    {isFornecedor ? (
                      <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    ) : (
                      <Handshake className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    )}
                    <input
                      id="rh-forn-nome"
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder={isFornecedor ? "Novo do fornecedor" : "Nome do consultor"}
                      className={`${inputClass} pl-9`}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="rh-forn-cargo" className={labelClass}>
                    Cargo / Função{" "}
                    {editingConsultorPre && !efetivarCadastro ? (
                      <span className="font-normal text-slate-500 dark:text-slate-400">(opcional até efetivar)</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">*</span>
                    )}
                  </label>
                  <div className="relative">
                    <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="rh-forn-cargo"
                      type="text"
                      value={cargoOuFuncao}
                      onChange={(e) => setCargoOuFuncao(e.target.value)}
                      placeholder="Ex.: Consultor de Vendas"
                      className={`${inputClass} pl-9`}
                      required={!editingConsultorPre || efetivarCadastro}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="rh-forn-contrato" className={labelClass}>
                    Tipo de contrato
                  </label>
                  <SearchableSelect
                    options={[...opcoesContratoB2b].sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }))}
                    value={tipoContrato}
                    onChange={(v) => setTipoContrato(v as TipoContratoUi)}
                    searchPlaceholder="Buscar tipo..."
                    placeholder="Selecione o tipo"
                    leadingIcon={BriefcaseBusiness}
                  />
                </div>
                <div>
                  <label htmlFor="rh-forn-status" className={labelClass}>
                    Status
                  </label>
                  <SearchableSelect
                    options={STATUS_OPTIONS}
                    value={status}
                    onChange={(v) => setStatus(v as ColaboradorParceiro["status"])}
                    searchable={false}
                    leadingIcon={ShieldCheck}
                  />
                </div>
                <div>
                  <label htmlFor="rh-forn-email" className={labelClass}>
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="rh-forn-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contato@empresa.com.br"
                      className={`${inputClass} pl-9`}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="rh-forn-tel" className={labelClass}>
                    Telefone
                  </label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="rh-forn-tel"
                      type="text"
                      inputMode="tel"
                      value={telefone}
                      onChange={(e) => setTelefone(formatBrazilianPhoneInput(e.target.value))}
                      placeholder="(00) 00000-0000"
                      className={`${inputClass} pl-9`}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "comissoes" && mostrarAbaComissoes && initialValues?.id && (
              <div
                id={`${fornecedorTabListId}-comissoes-panel`}
                role="tabpanel"
                aria-labelledby={`${fornecedorTabListId}-tab-comissoes`}
                className="space-y-4"
              >
                <ConsultorComissoesPanel consultorId={initialValues.id} />
              </div>
            )}

            {activeTab === "contatos" && (
              <div
                id={`${fornecedorTabListId}-contatos-panel`}
                role="tabpanel"
                aria-labelledby={`${fornecedorTabListId}-tab-contatos`}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Contatos vinculados</h4>
                  <button
                    type="button"
                    onClick={() => {
                      const novo = emptyContato();
                      setContatos((prev) => [...prev, novo]);
                      setExpandedContatoId(novo.id);
                    }}
                    className={formModalSubmitButtonClass}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Plus className="h-4 w-4 shrink-0" aria-hidden />
                      Adicionar contato
                    </span>
                  </button>
                </div>
                <ul className="space-y-4">
                  {contatos.map((c) => {
                    const isExpanded = expandedContatoId === c.id;
                    return (
                      <li key={c.id} className="border-t border-slate-200 pt-3 dark:border-slate-700">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setExpandedContatoId(isExpanded ? null : c.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setExpandedContatoId(isExpanded ? null : c.id);
                            }
                          }}
                          className="flex w-full items-center justify-between py-1 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {c.nome.trim() || "Novo contato"}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-400" />
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setContatoIdParaRemover(c.id);
                            }}
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                            aria-label="Remover contato"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="space-y-3 pt-2">
                            <div>
                              <label className={labelClass}>Nome</label>
                              <div className="relative">
                                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                  value={c.nome}
                                  onChange={(e) => updateContato(c.id, { nome: e.target.value })}
                                  placeholder="Nome completo"
                                  className={`${inputClass} pl-9`}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <div>
                                <label className={labelClass}>Cargo</label>
                                <div className="relative">
                                  <BriefcaseBusiness className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                  <input
                                    value={c.cargo ?? ""}
                                    onChange={(e) => updateContato(c.id, { cargo: e.target.value })}
                                    placeholder="Ex: Diretor"
                                    className={`${inputClass} pl-9`}
                                  />
                                </div>
                              </div>
                              <div>
                                <label className={labelClass}>Setor</label>
                                <div className="relative">
                                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                  <input
                                    value={c.setor ?? ""}
                                    onChange={(e) => updateContato(c.id, { setor: e.target.value })}
                                    placeholder="Ex: Comercial"
                                    className={`${inputClass} pl-9`}
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <div>
                                <label className={labelClass}>Telefone</label>
                                <div className="relative">
                                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                  <input
                                    value={c.telefone}
                                    inputMode="tel"
                                    onChange={(e) =>
                                      updateContato(c.id, { telefone: formatBrazilianPhoneInput(e.target.value) })
                                    }
                                    placeholder="(00) 00000-0000"
                                    className={`${inputClass} pl-9`}
                                  />
                                </div>
                              </div>
                              <div>
                                <label className={labelClass}>E-mail</label>
                                <div className="relative">
                                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                  <input
                                    type="email"
                                    value={c.email}
                                    onChange={(e) => updateContato(c.id, { email: e.target.value })}
                                    placeholder="email@empresa.com"
                                    className={`${inputClass} pl-9`}
                                  />
                                </div>
                              </div>
                            </div>
                            <div>
                              <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                                Papel do Contato (pode marcar mais de um)
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {PAPEIS_CONTATO_CLIENTE.map((opt) => {
                                  const checked = (c.papeis ?? []).includes(opt.value);
                                  return (
                                    <label
                                      key={opt.value}
                                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => togglePapel(c.id, opt.value)}
                                        className="h-3.5 w-3.5 rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9]"
                                      />
                                      {opt.label}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:justify-end sm:gap-3 lg:px-6">
            <button type="button" onClick={onCancel} className={formModalCancelButtonClass}>
              <span className="inline-flex items-center gap-2">
                <X className="h-4 w-4 shrink-0" aria-hidden />
                Cancelar
              </span>
            </button>
            {permitirSalvar ? (
              <button type="submit" className={formModalSubmitButtonClass}>
                <span className="inline-flex items-center gap-2">
                  <Save className="h-4 w-4 shrink-0" aria-hidden />
                  Salvar
                </span>
              </button>
            ) : null}
          </div>
        </form>
        <AlertDialog
          open={!!contatoIdParaRemover}
          onClose={() => setContatoIdParaRemover(null)}
          onConfirm={() => {
            if (contatoIdParaRemover) removeContato(contatoIdParaRemover);
            setContatoIdParaRemover(null);
          }}
          title="Remover contato?"
          description={
            contatoIdParaRemover ? (
              <>
                O contato <strong className="text-slate-900 dark:text-slate-100">{contatoRemocaoNome}</strong> será
                removido desta lista. Confirme para continuar.
              </>
            ) : null
          }
          cancelLabel="Cancelar"
          confirmLabel="Remover"
          destructive
        />
      </>
    );
  }

  const mostrarBarraAbasEquipe = isEquipeInterna && Boolean(initialValues?.id);

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {mostrarBarraAbasEquipe && (
        <div
          role="tablist"
          aria-label="Seções do cadastro"
          className="sticky top-0 z-30 flex flex-wrap border-b border-slate-200 bg-slate-50/95 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/95"
        >
          {(
            [
              { id: "dados" as const, label: "Dados", icon: User },
              { id: "comissoes" as const, label: "Comissões", icon: BadgePercent },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`${fornecedorTabListId}-tab-${t.id}`}
                aria-selected={isActive}
                aria-controls={`${fornecedorTabListId}-${t.id}-panel`}
                onClick={() => setActiveTab(t.id)}
                className={clsx(
                  "relative flex min-w-0 flex-1 items-center justify-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors sm:px-4",
                  isActive
                    ? "text-[#6D28D9] dark:text-violet-400"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId={`rh-equipe-form-tab-${fornecedorTabListId}`}
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6D28D9]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                  />
                )}
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 lg:p-6">
        {(!mostrarBarraAbasEquipe || activeTab === "dados") && (
          <div
            id={`${fornecedorTabListId}-dados-panel`}
            role={mostrarBarraAbasEquipe ? "tabpanel" : undefined}
            aria-labelledby={mostrarBarraAbasEquipe ? `${fornecedorTabListId}-tab-dados` : undefined}
            className="space-y-4"
          >
      <div>
        <label htmlFor="rh-nome" className={labelClass}>
          Nome <span className="text-red-600 dark:text-red-400">*</span>
        </label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="rh-nome"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome da pessoa"
            className={`${inputClass} pl-9`}
            required
          />
        </div>
      </div>
      <div>
        <label htmlFor="rh-cargo" className={labelClass}>
          Cargo / Função <span className="text-red-600 dark:text-red-400">*</span>
        </label>
        <div className="relative">
          <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="rh-cargo"
            type="text"
            value={cargoOuFuncao}
            onChange={(e) => setCargoOuFuncao(e.target.value)}
            placeholder="Ex.: Analista de Relacionamento"
            className={`${inputClass} pl-9`}
            required
          />
        </div>
      </div>
      <div>
        <label htmlFor="rh-cpf-cnpj" className={labelClass}>
          {isEquipeInterna ? <>CPF <span className="text-red-600 dark:text-red-400">*</span></> : <>CPF/CNPJ <span className="text-red-600 dark:text-red-400">*</span></>}
        </label>
        <div className="relative">
          <CreditCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="rh-cpf-cnpj"
            type="text"
            inputMode={isEquipeInterna ? "numeric" : "text"}
            value={cpfCnpj}
            onChange={(e) =>
              isEquipeInterna
                ? setCpfCnpj(maskCpfDigits(e.target.value.replace(/\D/g, "")))
                : setCpfCnpj(e.target.value)
            }
            placeholder={isEquipeInterna ? "000.000.000-00" : undefined}
            className={`${inputClass} pl-9`}
            required
          />
        </div>
      </div>
      <div>
        <label htmlFor="rh-contrato" className={labelClass}>
          Tipo de contrato
        </label>
        <SearchableSelect
          options={CONTRATO_OPTIONS_EQUIPE}
          value={tipoContrato}
          onChange={(v) => setTipoContrato(v as TipoContratoUi)}
          searchPlaceholder="Buscar tipo..."
          placeholder="Selecione o tipo"
          leadingIcon={BriefcaseBusiness}
        />
      </div>
      <div>
        <label htmlFor="rh-status" className={labelClass}>
          Status
        </label>
        <SearchableSelect
          options={STATUS_OPTIONS}
          value={status}
          onChange={(v) => setStatus(v as ColaboradorParceiro["status"])}
          searchable={false}
          leadingIcon={ShieldCheck}
        />
      </div>
      <div>
        <label htmlFor="rh-email" className={labelClass}>
          E-mail
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="rh-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pessoa@empresa.com.br"
            className={`${inputClass} pl-9`}
          />
        </div>
      </div>
      {isEquipeInterna && (
        <div>
          <label htmlFor="rh-tel-equipe" className={labelClass}>
            Telefone
          </label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="rh-tel-equipe"
              type="text"
              inputMode="tel"
              value={telefone}
              onChange={(e) => setTelefone(formatBrazilianPhoneInput(e.target.value))}
              placeholder="(00) 00000-0000"
              className={`${inputClass} pl-9`}
              autoComplete="tel"
            />
          </div>
        </div>
      )}
          </div>
        )}

        {mostrarBarraAbasEquipe && activeTab === "comissoes" && initialValues?.id && (
          <div
            id={`${fornecedorTabListId}-comissoes-panel`}
            role="tabpanel"
            aria-labelledby={`${fornecedorTabListId}-tab-comissoes`}
            className="space-y-4"
          >
            <ConsultorComissoesPanel consultorId={initialValues.id} />
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:justify-end sm:gap-3 lg:px-6">
        <button type="button" onClick={onCancel} className={formModalCancelButtonClass}>
          <span className="inline-flex items-center gap-2">
            <X className="h-4 w-4 shrink-0" aria-hidden />
            Cancelar
          </span>
        </button>
        {permitirSalvar ? (
          <button type="submit" className={formModalSubmitButtonClass}>
            <span className="inline-flex items-center gap-2">
              <Save className="h-4 w-4 shrink-0" aria-hidden />
              Salvar
            </span>
          </button>
        ) : null}
      </div>
    </form>
  );
}
