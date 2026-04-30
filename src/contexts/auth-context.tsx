"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { ModuloPermissao } from "@/lib/configuracoes/types";

type AuthSession = {
  perfilId: string | null;
  userId: string | null;
  userName: string | null;
  userCpf: string | null;
  userEmail: string | null;
  userPhone: string | null;
  clienteIds: string[];
  isPortalCliente: boolean;
  isAdminCliente: boolean;
  permissoes: Partial<Record<ModuloPermissao, boolean>>;
};

type AuthContextValue = {
  perfilId: string | null;
  session: AuthSession;
  setPerfilId: (id: string | null) => void;
  /** Consulta sessão no servidor e atualiza perfilId. Útil após login/logout. */
  syncFromCookie: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession>({
    perfilId: null,
    userId: null,
    userName: null,
    userCpf: null,
    userEmail: null,
    userPhone: null,
    clienteIds: [],
    isPortalCliente: false,
    isAdminCliente: false,
    permissoes: {},
  });

  const syncFromCookie = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (!response.ok) {
        setSession({
          perfilId: null,
          userId: null,
          userName: null,
          userCpf: null,
          userEmail: null,
          userPhone: null,
          clienteIds: [],
          isPortalCliente: false,
          isAdminCliente: false,
          permissoes: {},
        });
        return;
      }
      const payload = (await response.json()) as {
        data?: {
          perfilId?: string;
          userId?: string;
          userName?: string;
          userCpf?: string;
          userEmail?: string;
          userPhone?: string;
          clienteIds?: string[];
          isPortalCliente?: boolean;
          isAdminCliente?: boolean;
          permissoes?: Partial<Record<ModuloPermissao, boolean>>;
        };
      };
      setSession({
        perfilId: payload?.data?.perfilId ?? null,
        userId: payload?.data?.userId ?? null,
        userName: payload?.data?.userName ?? null,
        userCpf: payload?.data?.userCpf ?? null,
        userEmail: payload?.data?.userEmail ?? null,
        userPhone: payload?.data?.userPhone ?? null,
        clienteIds: payload?.data?.clienteIds ?? [],
        isPortalCliente: payload?.data?.isPortalCliente ?? false,
        isAdminCliente: payload?.data?.isAdminCliente ?? false,
        permissoes: payload?.data?.permissoes ?? {},
      });
    } catch {
      setSession({
        perfilId: null,
        userId: null,
        userName: null,
        userCpf: null,
        userEmail: null,
        userPhone: null,
        clienteIds: [],
        isPortalCliente: false,
        isAdminCliente: false,
        permissoes: {},
      });
    }
  }, []);

  useEffect(() => {
    void syncFromCookie();
  }, [syncFromCookie]);

  const setPerfilId = useCallback((id: string | null) => {
    setSession((prev) => ({ ...prev, perfilId: id }));
  }, []);

  return (
    <AuthContext.Provider value={{ perfilId: session.perfilId, session, setPerfilId, syncFromCookie }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
