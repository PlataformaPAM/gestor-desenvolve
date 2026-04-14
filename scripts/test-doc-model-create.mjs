import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
try {
  const r = await p.documentoModelo.create({
    data: {
      nome: "teste-script",
      tipo: "proposta_comercial",
      descricao: "",
      assunto: "",
      corpo: "x",
    },
  });
  console.log("OK", r.id);
  await p.documentoModelo.delete({ where: { id: r.id } });
  console.log("cleaned");
} catch (e) {
  console.error("ERR", e.code, e.message);
} finally {
  await p.$disconnect();
}
