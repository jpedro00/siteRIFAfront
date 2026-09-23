# Configuração dos frontends — 22/09/2026

## Local

Arquivos `.env.local` (ignorados pelo Git):

- storefront: `VITE_API_BASE_URL=http://localhost:3000`
- organizer: `VITE_API_BASE_URL=http://localhost:3000` e `VITE_STOREFRONT_BASE_URL=http://localhost:5173`
- admin: `VITE_API_BASE_URL=http://localhost:3000`

## Vercel

Cada projeto deve receber `VITE_API_BASE_URL=https://<api-real>` nos ambientes em que for publicado. O organizer também recebe `VITE_STOREFRONT_BASE_URL=https://<vitrine-real>`.

Somente `VITE_*` públicas ficam no Vercel. Banco, MFA, chaves administrativas e qualquer credencial futura de pagamento ficam no backend.

A resolução da API agora falha explicitamente em produção quando a variável está ausente ou aponta para localhost/loopback. Isso evita que um deploy aparentemente saudável faça requisições ao computador de quem abriu a página.

## Navegação e acessibilidade ajustadas

- URLs desconhecidas do organizador/admin exibem 404 útil dentro do painel, sem redirecionamento silencioso.
- menus móveis fecham com `Escape`, movem foco para o primeiro controle ao abrir e devolvem foco ao botão ao fechar por teclado.
- a folha móvel de números selecionados segue o mesmo comportamento de foco/`Escape`.
