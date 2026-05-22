"use client";

import { ConfiguracoesTopNav } from "@/components/configuracoes/configuracoes-top-nav";
import { DadosEmpresaFormSection } from "@/components/configuracoes/dados-empresa-form";
import {
  useConfiguracoesResourceRbac,
  useConfiguracoesSectionGuard,
} from "@/hooks/use-rbac-resource";

export default function DadosEmpresaPage() {
  useConfiguracoesSectionGuard("configuracoes.dados_empresa");
  const rbac = useConfiguracoesResourceRbac("configuracoes.dados_empresa");

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

      <DadosEmpresaFormSection permitirSalvar={rbac.podeEditar} />
    </section>
  );
}
