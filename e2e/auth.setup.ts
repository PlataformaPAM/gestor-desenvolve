import { test as setup } from "@playwright/test";
import { mkdir } from "node:fs/promises";

/** Mesmo caminho que `storageState` em `playwright.config.ts`. */
const AUTH_FILE = "e2e/.auth/user.json";

/**
 * Grava `storageState` com cookie de sessão (httpOnly vindo do POST /api/auth/login).
 * Obrigatório: PLAYWRIGHT_CPF e PLAYWRIGHT_SENHA (ex.: usuário do `npm run db:ensure-admin`).
 */
setup("autenticar API", async ({ request }) => {
  const cpf = process.env.PLAYWRIGHT_CPF?.replace(/\D/g, "") ?? "";
  const senha = process.env.PLAYWRIGHT_SENHA ?? "";
  if (!cpf || !senha) {
    throw new Error(
      "Defina PLAYWRIGHT_CPF e PLAYWRIGHT_SENHA para rodar os testes E2E (área logada). " +
        "Ex.: usuário criado por npm run db:ensure-admin. Ver QA-RESPONSIVO.md."
    );
  }

  const res = await request.post("/api/auth/login", {
    headers: { "Content-Type": "application/json" },
    data: JSON.stringify({ cpf, senha }),
  });
  if (!res.ok()) {
    throw new Error(`Login E2E falhou (${res.status()}): ${await res.text()}`);
  }

  await mkdir("e2e/.auth", { recursive: true });
  await request.storageState({ path: AUTH_FILE });
});
