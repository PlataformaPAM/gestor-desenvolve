import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomBytes, scryptSync } from "node:crypto";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL não definida.");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

async function ensureAdmin() {
  const perfil =
    (await prisma.perfilAcesso.findFirst({ where: { nome: "Administrador" } })) ??
    (await prisma.perfilAcesso.create({
      data: { nome: "Administrador", descricao: "Acesso irrestrito ao sistema" },
    }));

  const modulos = [
    "comercial",
    "financeiro",
    "tarefas",
    "clientes",
    "helpdesk",
    "posVenda",
    "rh",
    "configuracoes",
  ];

  for (const modulo of modulos) {
    await prisma.perfilPermissao.upsert({
      where: { perfilId_modulo: { perfilId: perfil.id, modulo } },
      create: { perfilId: perfil.id, modulo, permitido: true },
      update: { permitido: true },
    });
  }

  const senhaHash = hashPassword("admin123");
  await prisma.usuario.upsert({
    where: { cpf: "07202188961" },
    create: {
      cpf: "07202188961",
      email: "tecnologia@plataformapam.com.br",
      nomeExibicao: "Michel Silveira Raupp",
      telefone: "48999696149",
      perfilId: perfil.id,
      ativo: true,
      senhaHash,
    },
    update: {
      email: "tecnologia@plataformapam.com.br",
      nomeExibicao: "Michel Silveira Raupp",
      telefone: "48999696149",
      perfilId: perfil.id,
      ativo: true,
      senhaHash,
    },
  });

  console.log("Administrador real criado/atualizado com sucesso.");
}

ensureAdmin()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

