# QA responsivo (mobile + desktop)

Checklist manual para complementar os testes automatizados (`npm run test:e2e`).

## Viewports sugeridos

| Nome    | Largura × altura | Uso              |
|---------|------------------|------------------|
| Mobile  | 390 × 844        | Telefone comum   |
| Tablet  | 768 × 1024       | iPad retrato     |
| Desktop | 1280 × 720       | Notebook         |

No DevTools: alternar dispositivo + testar **retrato e paisagem** no mobile.

## Como rodar o smoke automatizado

1. Instalar browsers (uma vez): `npx playwright install chromium`
2. Banco e usuário de teste: garantir um usuário válido (ex.: `npm run db:ensure-admin` com `DATABASE_URL` configurada).
3. Credenciais E2E (obrigatório para rotas logadas): defina `PLAYWRIGHT_CPF` e `PLAYWRIGHT_SENHA` (mesmo CPF/senha do login real).
4. Rodar testes:
   - **PowerShell (servidor já em `npm run dev`):**  
     `$env:PLAYWRIGHT_CPF="00000000000"; $env:PLAYWRIGHT_SENHA="sua_senha"; $env:PLAYWRIGHT_SKIP_WEBSERVER="1"; npm run test:e2e`
   - **Ou** deixar o Playwright subir o dev (pode demorar na primeira compilação), com as mesmas variáveis de ambiente.

O projeto `setup` chama `POST /api/auth/login` e grava cookies em `e2e/.auth/user.json` (ignorado pelo Git).

## Shell global (todas as rotas logadas)

- [ ] Barra superior: título trunca sem empurrar layout; busca e ações cabem ou quebram sem sobreposição
- [ ] **Mobile (< lg):** barra inferior fixa visível (Home, Buscar, Alertas, Menu); conteúdo não fica atrás dela ao rolar até o fim
- [ ] **Desktop (≥ lg):** sidebar visível; conteúdo alinhado sem “faixa vazia” onde seria a sidebar

## Rotas — smoke rápido

Marque após testar **mobile** e **desktop** (ou use só mobile + desktop largo).

| Rota            | Mobile | Desktop | Notas |
|-----------------|--------|---------|-------|
| `/`             | [ ]    | [ ]     | Gráficos e cards |
| `/comercial`    | [ ]    | [ ]     | Kanban: scroll horizontal esperado |
| `/financeiro`   | [ ]    | [ ]     | Filtros, abas, Config + Novo lançamento |
| `/clientes`     | [ ]    | [ ]     | Busca, tabela/lista |
| `/solucoes`     | [ ]    | [ ]     | Drawer de edição |
| `/helpdesk`     | [ ]    | [ ]     | Filtros, sheet ticket |
| `/pos-venda`    | [ ]    | [ ]     | Cards, drawers |
| `/tarefas`      | [ ]    | [ ]     | Kanban: scroll horizontal |
| `/rh`           | [ ]    | [ ]     | Busca, tabela |
| `/configuracoes`| [ ]    | [ ]     | Abas, tabelas, drawers |
| `/calendario`   | [ ]    | [ ]     | Mês/semana: scroll horizontal na grade |
| `/arquivos`     | [ ]    | [ ]     | Tabela, menu contextual |
| `/alertas`      | [ ]    | [ ]     | Lista, exclusão |
| `/login`        | [ ]    | [ ]     | Teclado não cobre botão Entrar |
| `/acesso-negado`| [ ]    | [ ]     | Link voltar |

## Modais e formulários

- [ ] `DrawerSheet`: abre por baixo no mobile e pela direita no desktop; rolagem interna; fechar com overlay
- [ ] `Dialog`: cabe na tela; corpo com scroll se conteúdo longo
- [ ] Com teclado virtual (mobile real): campo ativo visível; botões de ação acessíveis

## Regressões já tratadas no código

- Padding lateral da sidebar **apenas** em `lg+` (evita “espaço fantasma” no mobile)
- `safe-area` na barra inferior e padding extra no `<main>` para não sobrepor conteúdo

## Matriz rápida (código + smoke)

| Rota | Mobile | Desktop | Observação |
|------|--------|---------|------------|
| `/` | OK | OK | Grids e gráficos responsivos |
| `/login` | OK | OK | Fora do shell |
| `/acesso-negado` | OK | OK | Com sessão; sem sessão o middleware manda para `/login` |
| `/comercial` | Atenção | OK | Kanban: scroll horizontal no mobile |
| `/financeiro` | OK | OK | Filtros em wrap; tabela com scroll |
| `/clientes` | OK | OK | Busca full-width no mobile |
| `/solucoes` | OK | OK | Drawer padrão |
| `/helpdesk` | OK | OK | Muitos filtros (wrap) |
| `/pos-venda` | OK | OK | Grids + drawers |
| `/tarefas` | Atenção | OK | Kanban: scroll horizontal |
| `/rh` | OK | OK | Busca + tabela |
| `/configuracoes` | OK | OK | Abas + drawers |
| `/calendario` | Atenção | OK | Mês/semana: scroll horizontal na grade |
| `/arquivos` | OK | OK | Colunas ocultas por breakpoint |
| `/alertas` | OK | OK | Lista em cards |

**Atenção** = comportamento esperado, validar gesto/toque em aparelho real.
