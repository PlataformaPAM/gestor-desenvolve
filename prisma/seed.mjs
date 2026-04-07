import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL não definida para seed.");
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.perfilPermissao.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.perfilAcesso.deleteMany();
  await prisma.lancamento.deleteMany();
  await prisma.helpdeskTicket.deleteMany();
  await prisma.tarefa.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.colaboradorRH.deleteMany();
  await prisma.solucaoCatalogo.deleteMany();

  const adminPerfil = await prisma.perfilAcesso.create({
    data: {
      nome: "Administrador",
      descricao: "Acesso total",
    },
  });

  await prisma.usuario.create({
    data: {
      cpf: "12345678900",
      email: "admin@gestorpam.local",
      nomeExibicao: "Admin GestorPAM",
      perfilId: adminPerfil.id,
      ativo: true,
    },
  });

  const cliente = await prisma.cliente.create({
    data: {
      nome: "Tech Solutions Ltda",
      empresa: "Tech Solutions Ltda",
      cpfCnpj: "12345678000190",
      status: "ativo",
      valorMensal: 4500,
      segmento: "tecnologia",
      email: "contato@techsolutions.com.br",
      telefone: "(11) 98765-4321",
      endereco: {
        create: {
          logradouro: "Av. Paulista",
          numero: "1000",
          bairro: "Bela Vista",
          cidade: "São Paulo",
          uf: "SP",
          cep: "01310100",
        },
      },
      contatos: {
        create: [
          {
            nome: "Carlos Silva",
            email: "carlos@techsolutions.com.br",
            telefone: "(11) 98765-4321",
            setor: "Comercial",
            cargo: "Diretor",
          },
        ],
      },
    },
  });

  const lead = await prisma.lead.create({
    data: {
      name: "Implantação ERP - Tech Solutions",
      value: 45000,
      valorTotal: 45000,
      stageId: "qualificacao",
      priority: "alta",
      enteredStageAt: new Date(),
      origem: "evento",
      cliente: { connect: { id: cliente.id } },
      checklistItems: {
        create: [
          { stageId: "qualificacao", taskKey: "geral-0", taskLabel: "Descobrir dor principal", done: true },
          { stageId: "qualificacao", taskKey: "geral-1", taskLabel: "Definir Solução/Serviço", done: false },
        ],
      },
      interactions: {
        create: [
          {
            date: new Date(),
            type: "sistema",
            action: "CREATE",
            description: "Lead criado via seed inicial.",
          },
        ],
      },
    },
  });

  await prisma.leadSolucao.create({
    data: {
      leadId: lead.id,
      nome: "Consultoria Financeira",
      valor: 12000,
      condicoesPagamento: "50% na assinatura, 50% em 30 dias",
    },
  });

  await prisma.helpdeskTicket.create({
    data: {
      codigo: "DES-2026-0001",
      clienteId: cliente.id,
      assunto: "Erro API no envio de pedidos",
      descricao: "Ao enviar pedido retorna erro 500.",
      status: "em_andamento",
      prioridade: "alta",
      categoria: "suporte_tecnico",
      dataCriacao: new Date(),
      previsaoConclusao: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      ultimaAtualizacao: new Date(),
    },
  });

  await prisma.tarefa.create({
    data: {
      titulo: "Revisar proposta comercial",
      descricao: "Validar valores e condições antes do envio",
      status: "em_andamento",
      prioridade: "urgente",
      dataInicio: new Date(),
      dataFim: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      cliente: { connect: { id: cliente.id } },
      responsavel: {
        connect: {
          email: "admin@gestorpam.local",
        },
      },
    },
  });

  await prisma.lancamento.create({
    data: {
      tipo: "entrada",
      descricao: "Mensalidade Plano Enterprise - Seed",
      cliente: { connect: { id: cliente.id } },
      vencimento: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      valor: 4500,
      status: "pendente",
      tipoRecorrencia: "unico",
    },
  });

  console.log("Seed concluído com sucesso.");
}

main()
  .catch((e) => {
    console.error("Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

