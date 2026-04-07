import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomBytes, scryptSync } from "node:crypto";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Defina DATABASE_URL (URL do PostgreSQL, ex.: produção na Railway).");
  process.exit(1);
}

const cpfRaw = process.env.BOOTSTRAP_ADMIN_CPF?.trim() ?? "";
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
const nomeExibicao = process.env.BOOTSTRAP_ADMIN_NOME?.trim() || "Administrador";
const telefone = process.env.BOOTSTRAP_ADMIN_TELEFONE?.trim() || null;

function normalizeCpf(value) {
  return value.replace(/\D/g, "");
}

const cpf = normalizeCpf(cpfRaw);

if (!cpf || cpf.length !== 11) {
  console.error(
    "Defina BOOTSTRAP_ADMIN_CPF com 11 dígitos (pode usar máscara; só números serão usados)."
  );
  process.exit(1);
}
if (password.length < 8) {
  console.error("Defina BOOTSTRAP_ADMIN_PASSWORD com pelo menos 8 caracteres.");
  process.exit(1);
}
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Defina BOOTSTRAP_ADMIN_EMAIL com um e-mail válido (único no sistema).");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(pw, salt, 64).toString("hex");
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

  const senhaHash = hashPassword(password);
  await prisma.usuario.upsert({
    where: { cpf },
    create: {
      cpf,
      email,
      nomeExibicao,
      telefone,
      perfilId: perfil.id,
      ativo: true,
      senhaHash,
    },
    update: {
      email,
      nomeExibicao,
      telefone,
      perfilId: perfil.id,
      ativo: true,
      senhaHash,
    },
  });

  console.log("Perfil Administrador e usuário inicial prontos.");
  console.log("Faça login com o CPF informado em BOOTSTRAP_ADMIN_CPF e a senha definida.");
}

ensureAdmin()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
