import { test, expect } from "@playwright/test";

/** Rotas que usam `DashboardShell` (área logada com `<main>`). Requer cookie de sessão (ver `auth.setup.ts`). */
const DASHBOARD_ROUTES = [
  "/",
  "/comercial",
  "/financeiro",
  "/clientes",
  "/contratos",
  "/solucoes",
  "/helpdesk",
  "/pos-venda",
  "/tarefas",
  "/rh",
  "/configuracoes",
  "/calendario",
  "/arquivos",
  "/alertas",
] as const;

test.describe("Páginas públicas (sem cookie de sessão)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login — formulário visível", async ({ page }) => {
    const res = await page.goto("/login");
    expect(res?.ok()).toBeTruthy();
    await expect(page.locator("#login-cpf")).toBeVisible();
    await expect(page.locator("#login-senha")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  });

  test("sem sessão — rota protegida redireciona para login", async ({ page }) => {
    await page.goto("/financeiro");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Acesso negado (com sessão)", () => {
  test("página acessível para usuário autenticado", async ({ page }) => {
    const res = await page.goto("/acesso-negado");
    expect(res?.ok()).toBeTruthy();
    await expect(
      page.getByRole("heading", { level: 1, name: "Acesso Negado" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Voltar ao início" })).toBeVisible();
  });
});

test.describe("Área logada (shell)", () => {
  for (const path of DASHBOARD_ROUTES) {
    test(`${path} — carrega e tem conteúdo principal`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.ok()).toBeTruthy();
      await expect(page.locator("main")).toBeVisible();
    });
  }

  test("navegação inferior só em viewports < lg", async ({ page }) => {
    await page.goto("/");
    const w = page.viewportSize()?.width ?? 0;
    const bottomHome = page.getByRole("link", { name: "Home" });
    if (w < 1024) {
      await expect(bottomHome).toBeVisible();
    } else {
      await expect(bottomHome).toBeHidden();
    }
  });

  test("documento sem overflow horizontal no nível raiz (tolera 1px)", async ({ page }) => {
    await page.goto("/financeiro");
    const delta = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth - el.clientWidth;
    });
    expect(delta).toBeLessThanOrEqual(1);
  });

  test("comercial — aba Lista usa largura útil do main (≥88% da área interna)", async ({ page }) => {
    await page.goto("/comercial");
    await page.getByRole("tab", { name: "Lista" }).click();
    await expect(page.getByTestId("comercial-lead-list")).toBeVisible();
    const wideEnough = await page.evaluate(() => {
      const main = document.querySelector("main");
      const list = document.querySelector('[data-testid="comercial-lead-list"]');
      if (!main || !list) return false;
      const style = window.getComputedStyle(main);
      const pad =
        parseFloat(style.paddingLeft || "0") + parseFloat(style.paddingRight || "0");
      const inner = main.clientWidth - pad;
      if (inner <= 0) return false;
      const lw = list.getBoundingClientRect().width;
      return lw / inner >= 0.88;
    });
    expect(wideEnough).toBe(true);
  });
});
