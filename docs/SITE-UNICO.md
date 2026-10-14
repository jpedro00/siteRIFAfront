# Site único: Storefront + Organizer + Admin num só projeto da Vercel

Um projeto (`rifas`, pasta raiz `apps/storefront`), um domínio, três apps:

| Endereço | App |
|---|---|
| `/` | Storefront (site público, marketplace, conta) |
| `/painel/` | Organizer (painel do criador) |
| `/admin/` | Admin (console da plataforma) |

Como funciona: `apps/storefront/vercel.json` roda `npm run build:site` (`scripts/build-site.mjs`), que compila os três apps com o caminho público certo (`VITE_BASE_PATH`) e copia o Organizer e o Admin para dentro de `apps/storefront/dist`. As reescritas do mesmo `vercel.json` devolvem o `index.html` de cada app nas rotas internas (`/painel/sorteios`, `/admin/usuarios`...). O script confere que cada `index.html` aponta para os arquivos do próprio prefixo; se não, o build falha.

**Nenhuma configuração do projeto muda** (pasta raiz, comandos): tudo vem do `vercel.json`.

## Variáveis do projeto (Production) — uma vez, valem para os três apps
Troque `<SITE>` pelo domínio do projeto (ex.: o endereço do Storefront):

| Variável | Valor |
|---|---|
| `VITE_API_BASE_URL` | `<SITE>` (a API é alcançada pelo proxy `/api`) |
| `VITE_MARKETPLACE_MODE` | `central` |
| `VITE_STOREFRONT_BASE_URL` | `<SITE>` |
| `VITE_ORGANIZER_BASE_URL` | `<SITE>/painel` |

Na API (Render): `CORS_ORIGINS` precisa conter `<SITE>` (já contém, é o mesmo domínio do Storefront) e `ORGANIZER_PANEL_URL`/`BILLING_RETURN_URL` devem apontar para `<SITE>/painel`.

Os `vercel.json` de `apps/organizer` e `apps/admin` continuam válidos para quem preferir um projeto por app (sem `VITE_BASE_PATH` o caminho público é `/`).
