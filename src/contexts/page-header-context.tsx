"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type PrimaryAction = {
  label: string;
  onClick: () => void;
  showPlusIcon?: boolean;
  tone?: "primary" | "navigation";
};

/** Ação secundária (ex.: ícone de configurações à esquerda do botão principal). */
export type SecondaryHeaderAction = {
  onClick: () => void;
  ariaLabel: string;
};

type PageHeaderContextValue = {
  title: string;
  setTitle: (title: string) => void;
  primaryAction: PrimaryAction | null;
  setPrimaryAction: (action: PrimaryAction | null) => void;
  secondaryAction: SecondaryHeaderAction | null;
  setSecondaryAction: (action: SecondaryHeaderAction | null) => void;
};

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

const DEFAULT_TITLES: Record<string, string> = {
  "/": "Central de Comandos",
  "/comercial": "Funil de Vendas",
  "/financeiro": "Financeiro",
  "/financeiro/extrato": "Extrato Financeiro",
  "/financeiro/comissoes": "Financeiro · Comissões",
  "/clientes": "Gestão de Clientes",
  "/contratos": "Contratos",
  "/solucoes": "Soluções e Playbooks",
  "/helpdesk": "Suporte",
  "/suporte": "Suporte",
  "/relatorios": "Relatórios",
  "/relatorios/saude-empresa": "Relatórios · Saúde da Empresa",
  "/relatorios/operacional": "Relatórios · Operacional",
  "/relatorios/financeiro": "Relatórios · Financeiro",
  "/relatorios/comercial": "Relatórios · Comercial",
  "/relatorios/prestacao-contas": "Relatórios · Prestação de Contas",
  "/portal": "Portal do Cliente",
  "/portal/chamados": "Portal do Cliente · Suporte",
  "/portal/meu-perfil": "Portal do Cliente · Meu Perfil",
  "/portal/usuarios": "Portal do Cliente · Usuários",
  "/pos-venda": "Pós-venda",
  "/tarefas": "Tarefas Internas",
  "/rh": "Gestão de Pessoas",
  "/configuracoes": "Configurações",
  "/configuracoes/usuarios": "Configurações · Usuários",
  "/configuracoes/perfis": "Configurações · Perfis de Acesso",
  "/configuracoes/logs": "Configurações · Logs do Sistema",
  "/configuracoes/construtor-documentos": "Configurações · Construtor de Documentos",
  "/calendario": "Calendário da Equipe",
  "/arquivos": "Drive Interno",
  "/alertas": "Minha Caixa",
};

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [title, setTitleState] = useState("Central de Comandos");
  const [primaryAction, setPrimaryAction] = useState<PrimaryAction | null>(null);
  const [secondaryAction, setSecondaryAction] = useState<SecondaryHeaderAction | null>(null);

  const setTitle = useCallback((t: string) => {
    setTitleState(t);
  }, []);

  return (
    <PageHeaderContext.Provider
      value={{
        title,
        setTitle,
        primaryAction,
        setPrimaryAction,
        secondaryAction,
        setSecondaryAction,
      }}
    >
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeader() {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) throw new Error("usePageHeader must be used within PageHeaderProvider");
  return ctx;
}

export function usePageTitleFromPath(pathname: string) {
  const fromMap = DEFAULT_TITLES[pathname];
  if (fromMap) return fromMap;
  if (pathname.startsWith("/contratos/")) return "Contrato";
  return "Gestor Desenvolve";
}
