import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke E2E responsivo. Subir o app antes ou deixar o Playwright iniciar o dev server.
 *
 * Variáveis opcionais:
 * - PLAYWRIGHT_BASE_URL (default http://127.0.0.1:3000)
 * - PLAYWRIGHT_SKIP_WEBSERVER=1 — não inicia `npm run dev` (use servidor já rodando)
 * - PLAYWRIGHT_CPF / PLAYWRIGHT_SENHA — obrigatórios para testes da área logada (setup grava e2e/.auth/user.json)
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const AUTH_STORAGE = "e2e/.auth/user.json";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts$/,
    },
    {
      name: "Mobile",
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts$/,
      use: {
        ...devices["Pixel 5"],
        storageState: AUTH_STORAGE,
      },
    },
    {
      name: "Tablet",
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts$/,
      use: {
        viewport: { width: 768, height: 1024 },
        storageState: AUTH_STORAGE,
      },
    },
    {
      name: "Desktop",
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: AUTH_STORAGE,
      },
    },
  ],
  ...(process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? {}
    : {
        webServer: {
          command: "npm run dev",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      }),
});
