# TironiRifa — frontend

As tres aplicacoes React da plataforma de sorteios por comunidades. A API, o
worker e o banco vivem em `tironirifa-backend`.

Os dois repositorios instalam e compilam sem depender da pasta local um do
outro: nenhuma dependencia `file:../` atravessa a fronteira.

## Estrutura

```
apps/storefront     Vitrine do participante.  /, /sorteios, /sorteio/:slug,
                    /sorteio/:slug/checkout, /pedido/:id, /conta
apps/organizer      Painel da comunidade.     /, /sorteios, /sorteios/novo,
                    /sorteios/:id, /equipe, /auditoria
apps/admin          Console da plataforma.    gestao de comunidades
packages/shared     Contratos (espelhados do backend) + helpers de UI + estilos
```

Cada aplicacao e um projeto separado no Vercel, com seu proprio `vercel.json` e
seu proprio dominio.

## `packages/shared` tem duas metades diferentes

| Diretorio | Origem | Pode editar aqui? |
|---|---|---|
| `src/contracts`, `src/states`, `src/permissions`, `src/constants` | copia do backend | **Nao** |
| `src/frontend`, `styles/` | deste repositorio | Sim |

A primeira metade e um snapshot conferido por sha256 contra
`packages/shared/CONTRACTS_SNAPSHOT.json`:

```bash
npm run contracts:verify
```

O CI e o build do Vercel rodam essa verificacao **antes** de compilar. Uma
edicao feita so deste lado nao quebraria typecheck nenhum: os dois repositorios
continuariam compilando, e a diferenca apareceria no navegador de quem compra,
como um campo que a API recusa. A conferencia transforma isso em falha de build,
com o arquivo divergente nomeado.

Para mudar um contrato: altere em `tironirifa-backend`, rode
`npm run contracts:snapshot` la subindo a versao do pacote, e traga as quatro
arvores junto com o manifesto.

**Permissao aqui e apresentacao** — esconder um botao que o usuario nao pode
usar. A autorizacao e decidida pela API, contra o vinculo no PostgreSQL. Nunca
trate uma checagem deste lado como barreira de seguranca.

## Setup local

```bash
npm ci
# Os comandos raiz agora preparam @campaigns/shared automaticamente.
cp apps/storefront/.env.example apps/storefront/.env.local
cp apps/organizer/.env.example apps/organizer/.env.local
cp apps/admin/.env.example apps/admin/.env.local
```

Com a API do outro repositorio rodando em `http://localhost:3000`:

```bash
npm run dev:storefront    # http://localhost:5173
npm run dev:organizer     # http://localhost:5174
npm run dev:admin         # http://localhost:5175
```

As tres portas precisam estar em `CORS_ORIGINS` no `.env` do backend. A API
autentica por cookie, e `credentials: include` e incompativel com `*`: cada
origem e declarada uma a uma, nunca por curinga.

## Variaveis de ambiente

Tudo aqui e publico. O Vite substitui cada `VITE_*` pelo valor literal no pacote
entregue ao navegador — quem abre o site le o conteudo. **Nao existe segredo "so
no frontend"**: se precisa ficar escondido, pertence a API.

| Variavel | Onde |
|---|---|
| `VITE_API_BASE_URL` | as tres aplicacoes |
| `VITE_STOREFRONT_BASE_URL` | so o organizador (botao "Ver na vitrine") |

Os valores de cada ambiente vao no painel do Vercel, por projeto e por
Production/Preview/Development.

## Verificacao

```bash
npm run contracts:verify
npm run lint
npm run typecheck
npm test
npm run build
```

A suite deste repositorio cobre os helpers de `src/frontend` — formatacao,
estado de sessao, montagem da URL da vitrine. **Nao ha teste dos componentes
React**: era assim no monorepo e continua sendo, e a separacao nao melhorou nem
piorou essa cobertura. Nenhum teste aqui toca banco; os que exigem PostgreSQL
ficaram no backend, junto do banco de que precisam.

## Deploy (Vercel)

Um projeto por aplicacao, com **Root Directory** em `apps/<app>`. O
`vercel.json` de cada uma instala na raiz do repositorio (`npm ci --prefix ../..`),
confere o snapshot dos contratos e so entao compila. `rewrites` manda toda rota
para `index.html`, porque o roteamento e do lado do cliente.

Ao configurar os dominios, `VITE_API_BASE_URL` precisa apontar para a API real.
O fallback para `localhost` existe somente em desenvolvimento; um bundle de
produção agora recusa variável ausente ou endereço de loopback explicitamente.

## Pendencias herdadas

Continuam abertas e **nao** foram introduzidas nem resolvidas pela separacao:
resolucao de comunidade por host de tres segmentos, fragil em previews e dominios personalizados; equipe sem
convite/remocao; conta sem consolidacao segura de pedidos autenticados;
listagens limitadas a 200 sem paginacao; ausencia de PIX/PSP real. Ver
`docs/separacao/RELATORIO.md`.
