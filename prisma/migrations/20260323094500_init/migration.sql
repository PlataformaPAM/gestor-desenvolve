-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PipelineStageId" AS ENUM ('prospecao', 'qualificacao', 'proposta', 'contratacao', 'fechado', 'perdido');

-- CreateEnum
CREATE TYPE "LeadPriority" AS ENUM ('alta', 'media', 'baixa');

-- CreateEnum
CREATE TYPE "LeadOrigem" AS ENUM ('email', 'whatsapp', 'ligacao', 'instagram', 'facebook', 'site', 'email_marketing', 'evento', 'indicacao', 'outro');

-- CreateEnum
CREATE TYPE "LeadInteractionType" AS ENUM ('etapa', 'contato', 'observacao', 'ganhou', 'sistema', 'arquivo', 'proposta');

-- CreateEnum
CREATE TYPE "LeadInteractionAction" AS ENUM ('CREATE', 'UPDATE');

-- CreateEnum
CREATE TYPE "PapelContato" AS ENUM ('gestor_principal', 'gestor_contrato', 'gestor_financeiro', 'tecnico', 'operador');

-- CreateEnum
CREATE TYPE "ClienteStatus" AS ENUM ('ativo', 'inativo', 'inadimplente');

-- CreateEnum
CREATE TYPE "ClienteSegmento" AS ENUM ('varejo', 'industria', 'servicos', 'tecnologia', 'outros');

-- CreateEnum
CREATE TYPE "PropostaStatus" AS ENUM ('aceita', 'recusada', 'pendente');

-- CreateEnum
CREATE TYPE "FaturaStatus" AS ENUM ('paga', 'pendente', 'vencida');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('aberto', 'em_andamento', 'resolvido');

-- CreateEnum
CREATE TYPE "HelpdeskTicketStatus" AS ENUM ('novo', 'em_andamento', 'aguardando_cliente', 'aguardando_equipe', 'pendente', 'respondido', 'finalizado', 'nao_solucionado');

-- CreateEnum
CREATE TYPE "HelpdeskTicketPrioridade" AS ENUM ('baixa', 'media', 'alta', 'critica');

-- CreateEnum
CREATE TYPE "HelpdeskTicketCategoria" AS ENUM ('comercial', 'financeiro', 'suporte_tecnico', 'duvida', 'sugestao');

-- CreateEnum
CREATE TYPE "HelpdeskComentarioAutorTipo" AS ENUM ('cliente', 'atendente', 'sistema');

-- CreateEnum
CREATE TYPE "TarefaStatus" AS ENUM ('a_fazer', 'em_andamento', 'impedimento', 'concluido');

-- CreateEnum
CREATE TYPE "TarefaPrioridade" AS ENUM ('baixa', 'media', 'alta', 'urgente');

-- CreateEnum
CREATE TYPE "LancamentoStatus" AS ENUM ('pago', 'pendente', 'atrasado');

-- CreateEnum
CREATE TYPE "LancamentoTipo" AS ENUM ('entrada', 'saida');

-- CreateEnum
CREATE TYPE "TipoRecorrencia" AS ENUM ('unico', 'fixo_mensal', 'parcelado');

-- CreateEnum
CREATE TYPE "ModuloPermissao" AS ENUM ('comercial', 'financeiro', 'tarefas', 'clientes', 'helpdesk', 'posVenda', 'rh', 'configuracoes');

-- CreateEnum
CREATE TYPE "PessoaVinculoTipo" AS ENUM ('rh', 'cliente');

-- CreateEnum
CREATE TYPE "TipoContrato" AS ENUM ('clt', 'pj', 'estagio', 'parceiro', 'fornecedor');

-- CreateEnum
CREATE TYPE "StatusColaborador" AS ENUM ('ativo', 'inativo', 'ferias', 'afastado');

-- CreateEnum
CREATE TYPE "TipoPessoaRH" AS ENUM ('equipe_interna', 'vendedor_externo', 'fornecedor_parceiro');

-- CreateEnum
CREATE TYPE "TipoContaBancaria" AS ENUM ('corrente', 'poupanca');

-- CreateEnum
CREATE TYPE "FinanceiroFluxoStatus" AS ENUM ('nenhum', 'pendente_aprovacao', 'lancado', 'devolvido');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nomeExibicao" TEXT,
    "perfilId" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "vinculacaoTipo" "PessoaVinculoTipo",
    "vinculacaoPessoaId" TEXT,
    "criadoEm" TIMESTAMP(3),
    "atualizadoEmSistema" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfilAcesso" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfilAcesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfilPermissao" (
    "id" TEXT NOT NULL,
    "perfilId" TEXT NOT NULL,
    "modulo" "ModuloPermissao" NOT NULL,
    "permitido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfilPermissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogSistema" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "modulo" TEXT,
    "detalhes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogSistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "empresa" TEXT NOT NULL,
    "cpfCnpj" TEXT NOT NULL,
    "status" "ClienteStatus" NOT NULL,
    "valorMensal" DOUBLE PRECISION NOT NULL,
    "segmento" "ClienteSegmento" NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "urlSiteOficial" TEXT,
    "dataFechamento" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClienteEndereco" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "complemento" TEXT,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClienteEndereco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClienteContato" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "setor" TEXT,
    "cargo" TEXT,
    "papelLegado" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClienteContato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClienteContatoPapel" (
    "id" TEXT NOT NULL,
    "clienteContatoId" TEXT NOT NULL,
    "papel" "PapelContato" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClienteContatoPapel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClienteProposta" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "dataProposta" TIMESTAMP(3) NOT NULL,
    "status" "PropostaStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClienteProposta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClienteFatura" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "status" "FaturaStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClienteFatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClienteTicketResumo" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "dataAbertura" TIMESTAMP(3) NOT NULL,
    "status" "TicketStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClienteTicketResumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolucaoCatalogo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "valorBase" DOUBLE PRECISION,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolucaoCatalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "stageId" "PipelineStageId" NOT NULL,
    "priority" "LeadPriority" NOT NULL,
    "enteredStageAt" TIMESTAMP(3) NOT NULL,
    "origem" "LeadOrigem" NOT NULL,
    "clienteId" TEXT,
    "propostaGeradaEm" TIMESTAMP(3),
    "previsaoFechamento" TIMESTAMP(3),
    "cpf" TEXT,
    "company" TEXT,
    "contact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "municipioUf" TEXT,
    "entidade" TEXT,
    "cargo" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadSolucao" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "solucaoCatalogoId" TEXT,
    "nome" TEXT NOT NULL,
    "valor" DOUBLE PRECISION,
    "condicoesPagamento" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadSolucao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadContato" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "clienteContatoId" TEXT,
    "nome" TEXT NOT NULL,
    "cargo" TEXT,
    "setor" TEXT,
    "telefone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadContato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadContatoPapel" (
    "id" TEXT NOT NULL,
    "leadContatoId" TEXT NOT NULL,
    "papel" "PapelContato" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadContatoPapel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadChecklistItem" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "stageId" "PipelineStageId" NOT NULL,
    "taskKey" TEXT NOT NULL,
    "taskLabel" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadContratoChecklist" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "aprovacaoCliente" BOOLEAN NOT NULL DEFAULT false,
    "recebimentoDocumentacao" BOOLEAN NOT NULL DEFAULT false,
    "envioDocumentacao" BOOLEAN NOT NULL DEFAULT false,
    "ordemCompra" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadContratoChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadContratoArquivo" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadContratoArquivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadFinanceiroFluxo" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" "FinanceiroFluxoStatus" NOT NULL DEFAULT 'nenhum',
    "bloqueadoEdicao" BOOLEAN NOT NULL DEFAULT false,
    "solicitadoEm" TIMESTAMP(3),
    "aprovadoEm" TIMESTAMP(3),
    "devolvidoEm" TIMESTAMP(3),
    "motivoDevolucao" TEXT,
    "liberacaoSolicitadaEm" TIMESTAMP(3),
    "motivoSolicitacaoLiberacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadFinanceiroFluxo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadInteraction" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "LeadInteractionType" NOT NULL,
    "description" TEXT NOT NULL,
    "userId" TEXT,
    "action" "LeadInteractionAction",
    "field" TEXT,
    "fieldKey" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadInteractionAnexo" (
    "id" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadInteractionAnexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarefa" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "TarefaStatus" NOT NULL,
    "prioridade" "TarefaPrioridade" NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "clienteId" TEXT,
    "solucaoId" TEXT,
    "responsavelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tarefa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarefaColaborador" (
    "id" TEXT NOT NULL,
    "tarefaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TarefaColaborador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarefaAnexo" (
    "id" TEXT NOT NULL,
    "tarefaId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TarefaAnexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarefaHistorico" (
    "id" TEXT NOT NULL,
    "tarefaId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "acao" TEXT NOT NULL,
    "autorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TarefaHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarefaHistoricoAnexo" (
    "id" TEXT NOT NULL,
    "historicoId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TarefaHistoricoAnexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpdeskTicket" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" "HelpdeskTicketStatus" NOT NULL,
    "prioridade" "HelpdeskTicketPrioridade" NOT NULL,
    "categoria" "HelpdeskTicketCategoria" NOT NULL,
    "dataCriacao" TIMESTAMP(3) NOT NULL,
    "previsaoConclusao" TIMESTAMP(3) NOT NULL,
    "ultimaAtualizacao" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpdeskTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpdeskTicketResponsavel" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpdeskTicketResponsavel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpdeskHistorico" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "acao" TEXT NOT NULL,
    "autorId" TEXT,
    "detalhe" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpdeskHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpdeskHistoricoAnexo" (
    "id" TEXT NOT NULL,
    "historicoId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpdeskHistoricoAnexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpdeskComentario" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "autorId" TEXT,
    "autorNomeSnapshot" TEXT NOT NULL,
    "autorTipo" "HelpdeskComentarioAutorTipo" NOT NULL,
    "texto" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpdeskComentario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpdeskComentarioAnexo" (
    "id" TEXT NOT NULL,
    "comentarioId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpdeskComentarioAnexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpdeskAnexo" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpdeskAnexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColaboradorRH" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cargoOuFuncao" TEXT NOT NULL,
    "tipoContrato" "TipoContrato" NOT NULL,
    "status" "StatusColaborador" NOT NULL,
    "tipoPessoa" "TipoPessoaRH" NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "cpfCnpj" TEXT,
    "totalVendasMes" DOUBLE PRECISION,
    "ultimoAcesso" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColaboradorRH_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColaboradorDadosBancarios" (
    "id" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "banco" TEXT,
    "agencia" TEXT,
    "conta" TEXT,
    "tipoConta" "TipoContaBancaria",
    "pix" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColaboradorDadosBancarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColaboradorDocumento" (
    "id" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColaboradorDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lancamento" (
    "id" TEXT NOT NULL,
    "tipo" "LancamentoTipo" NOT NULL,
    "descricao" TEXT NOT NULL,
    "clienteId" TEXT,
    "fornecedor" TEXT,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "status" "LancamentoStatus" NOT NULL,
    "dataPagamento" TIMESTAMP(3),
    "tipoRecorrencia" "TipoRecorrencia",
    "parcelas" INTEGER,
    "idPai" TEXT,
    "parcelaNumero" INTEGER,
    "leadIdOrigem" TEXT,
    "formaPagamento" TEXT,
    "condicoesPagamento" TEXT,
    "prazoDias" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lancamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_cpf_key" ON "Usuario"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PerfilPermissao_perfilId_modulo_key" ON "PerfilPermissao"("perfilId", "modulo");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_cpfCnpj_key" ON "Cliente"("cpfCnpj");

-- CreateIndex
CREATE UNIQUE INDEX "ClienteEndereco_clienteId_key" ON "ClienteEndereco"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "ClienteContatoPapel_clienteContatoId_papel_key" ON "ClienteContatoPapel"("clienteContatoId", "papel");

-- CreateIndex
CREATE UNIQUE INDEX "LeadContatoPapel_leadContatoId_papel_key" ON "LeadContatoPapel"("leadContatoId", "papel");

-- CreateIndex
CREATE UNIQUE INDEX "LeadChecklistItem_leadId_taskKey_key" ON "LeadChecklistItem"("leadId", "taskKey");

-- CreateIndex
CREATE UNIQUE INDEX "LeadContratoChecklist_leadId_key" ON "LeadContratoChecklist"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadFinanceiroFluxo_leadId_key" ON "LeadFinanceiroFluxo"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "TarefaColaborador_tarefaId_usuarioId_key" ON "TarefaColaborador"("tarefaId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "HelpdeskTicket_codigo_key" ON "HelpdeskTicket"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "HelpdeskTicketResponsavel_ticketId_usuarioId_key" ON "HelpdeskTicketResponsavel"("ticketId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ColaboradorDadosBancarios_colaboradorId_key" ON "ColaboradorDadosBancarios"("colaboradorId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "PerfilAcesso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilPermissao" ADD CONSTRAINT "PerfilPermissao_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "PerfilAcesso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogSistema" ADD CONSTRAINT "LogSistema_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteEndereco" ADD CONSTRAINT "ClienteEndereco_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteContato" ADD CONSTRAINT "ClienteContato_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteContatoPapel" ADD CONSTRAINT "ClienteContatoPapel_clienteContatoId_fkey" FOREIGN KEY ("clienteContatoId") REFERENCES "ClienteContato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteProposta" ADD CONSTRAINT "ClienteProposta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteFatura" ADD CONSTRAINT "ClienteFatura_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteTicketResumo" ADD CONSTRAINT "ClienteTicketResumo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSolucao" ADD CONSTRAINT "LeadSolucao_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSolucao" ADD CONSTRAINT "LeadSolucao_solucaoCatalogoId_fkey" FOREIGN KEY ("solucaoCatalogoId") REFERENCES "SolucaoCatalogo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadContato" ADD CONSTRAINT "LeadContato_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadContato" ADD CONSTRAINT "LeadContato_clienteContatoId_fkey" FOREIGN KEY ("clienteContatoId") REFERENCES "ClienteContato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadContatoPapel" ADD CONSTRAINT "LeadContatoPapel_leadContatoId_fkey" FOREIGN KEY ("leadContatoId") REFERENCES "LeadContato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadChecklistItem" ADD CONSTRAINT "LeadChecklistItem_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadContratoChecklist" ADD CONSTRAINT "LeadContratoChecklist_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadContratoArquivo" ADD CONSTRAINT "LeadContratoArquivo_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadFinanceiroFluxo" ADD CONSTRAINT "LeadFinanceiroFluxo_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadInteraction" ADD CONSTRAINT "LeadInteraction_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadInteraction" ADD CONSTRAINT "LeadInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadInteractionAnexo" ADD CONSTRAINT "LeadInteractionAnexo_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "LeadInteraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarefaColaborador" ADD CONSTRAINT "TarefaColaborador_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "Tarefa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarefaColaborador" ADD CONSTRAINT "TarefaColaborador_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarefaAnexo" ADD CONSTRAINT "TarefaAnexo_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "Tarefa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarefaHistorico" ADD CONSTRAINT "TarefaHistorico_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "Tarefa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarefaHistorico" ADD CONSTRAINT "TarefaHistorico_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarefaHistoricoAnexo" ADD CONSTRAINT "TarefaHistoricoAnexo_historicoId_fkey" FOREIGN KEY ("historicoId") REFERENCES "TarefaHistorico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpdeskTicket" ADD CONSTRAINT "HelpdeskTicket_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpdeskTicketResponsavel" ADD CONSTRAINT "HelpdeskTicketResponsavel_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "HelpdeskTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpdeskTicketResponsavel" ADD CONSTRAINT "HelpdeskTicketResponsavel_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpdeskHistorico" ADD CONSTRAINT "HelpdeskHistorico_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "HelpdeskTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpdeskHistorico" ADD CONSTRAINT "HelpdeskHistorico_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpdeskHistoricoAnexo" ADD CONSTRAINT "HelpdeskHistoricoAnexo_historicoId_fkey" FOREIGN KEY ("historicoId") REFERENCES "HelpdeskHistorico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpdeskComentario" ADD CONSTRAINT "HelpdeskComentario_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "HelpdeskTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpdeskComentario" ADD CONSTRAINT "HelpdeskComentario_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpdeskComentarioAnexo" ADD CONSTRAINT "HelpdeskComentarioAnexo_comentarioId_fkey" FOREIGN KEY ("comentarioId") REFERENCES "HelpdeskComentario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpdeskAnexo" ADD CONSTRAINT "HelpdeskAnexo_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "HelpdeskTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColaboradorDadosBancarios" ADD CONSTRAINT "ColaboradorDadosBancarios_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "ColaboradorRH"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColaboradorDocumento" ADD CONSTRAINT "ColaboradorDocumento_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "ColaboradorRH"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_leadIdOrigem_fkey" FOREIGN KEY ("leadIdOrigem") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

