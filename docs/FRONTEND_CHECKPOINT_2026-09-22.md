# Checkpoint frontend — 22/09/2026

## Escopo

Prioridade mantida: estrutura, navegação, comportamento e qualidade de uso antes de PIX/PSP.
Nenhuma migration, regra de reserva, autorização, cobrança ou conciliação foi alterada.

---

## Rodada 1 — configuração e navegação

- `VITE_API_BASE_URL` centralizada em `resolveApiBaseUrl`.
- desenvolvimento mantém fallback local; bundle de produção recusa variável ausente e loopback.
- `.env.local` público criado para storefront, organizer e admin.
- comandos raiz preparam `@campaigns/shared` antes de dev/typecheck/test; um clone limpo não depende de `dist` antigo do ZIP.
- rotas desconhecidas do organizer e admin exibem 404 com saída útil, sem redirecionamento silencioso.
- menu móvel da vitrine e drawers de organizer/admin fecham com `Escape`, focam um controle ao abrir e devolvem foco ao botão ao fechar por teclado.
- sheet móvel de números selecionados recebeu o mesmo tratamento de foco/`Escape`.

---

## Rodada 2 — inspeção em navegador com API e banco reais

A rodada anterior fechou sem `npm test`, sem bundle Vite e **sem navegador**. Esta
subiu um PostgreSQL descartável, a API, as três aplicações, e percorreu as telas.
O que segue foi encontrado olhando a tela, não lendo o código.

### 1. O painel do sorteio afirmava duas coisas diferentes sobre o mesmo dado

`ProgressBar` rotulava `total - paid` como **"N números restantes"**. No painel do
sorteio essa linha aparecia imediatamente acima de **"Disponíveis 488 de 500"**,
calculada a partir de `takenCount`. Lado a lado, "500 números restantes" e
"Disponíveis 488 de 500".

As duas contas estão certas e respondem perguntas diferentes: `total - paid` é
"quanto ainda não foi vendido"; `total - takenCount` é "quanto dá para escolher
agora". Um número reservado por outra pessoa não foi vendido **e** não está
livre — é exatamente a diferença. O rótulo é que prometia disponibilidade a
partir da conta de venda.

`publicDrawSummary` (catálogo) não carrega `takenCount`; só o detalhe carrega.
Então o rodapé da barra passou a falar apenas de venda — `0 de 500 vendidos` —,
que vale nos dois lugares, e a disponibilidade continua na linha "Disponíveis",
onde o dado existe. RN18 preservada: a barra segue contando só o que foi PAGO.

`apps/storefront/src/components/ProgressBar.tsx`

### 2. Escolher um número fazia o contador de disponíveis cair

O cabeçalho da grade lia `livres.length`, e `livres` exclui a seleção local —
correto para o pool do "Surpreenda-me", que não pode sortear um número já
escolhido, e errado como rótulo. Marcar três números fazia "488 de 500
disponíveis" virar "485", como se escolher já tivesse tirado algo de circulação.
Não tirou: até o servidor aceitar a reserva, aqueles números seguem disponíveis
para todos, inclusive para quem os marcou.

O pool continua como estava; o rótulo passou a contar apenas o que o servidor
marcou como ocupado.

`apps/storefront/src/components/NumberGrid.tsx`

### 3. O cronômetro da reserva existia e não era visto

Nenhuma das três aplicações tinha controle de rolagem. Numa SPA o navegador não
volta ao topo sozinho, então quem escolhia números no meio da grade e clicava em
"Reservar" caía no checkout **já rolado** — abaixo do título, do link de voltar
e do cronômetro de 30 minutos. A contagem estava implementada, correta e
ancorada no `expiresAt` do servidor; simplesmente abria fora da tela.

`ScrollToTop` decide pelo tipo de navegação: PUSH/REPLACE vai ao topo, POP
(voltar/avançar) fica com o navegador, que guardou a posição. Âncoras `#secao`
têm preferência sobre o topo.

Uma primeira versão colocava `history.scrollRestoration` em `'manual'` e com isso
desligava a restauração do POP — voltar passava a cair no topo. O padrão `'auto'`
já faz o certo; a linha saiu.

`apps/{storefront,organizer,admin}/src/components/ScrollToTop.tsx` · os três `App.tsx`

### 4. Textos que prometiam um pagamento que não existe

- home, passo 3: "Finalize a compra — Informe seus dados de contato e **confirme o
  pagamento**" → "Registre seu pedido — Informe seus dados de contato para o
  pedido ficar no seu nome."
- pedido PENDENTE: "**Conclua o pagamento** para garanti-los" → "Seus números
  estão reservados até o fim do prazo. O pagamento é combinado diretamente com a
  organização da comunidade."

Não há provedor de pagamento integrado. Mandar concluir um pagamento que a tela
não oferece faz a pessoa procurar um botão inexistente e concluir que o site
quebrou. A caixa "AMBIENTE DE DESENVOLVIMENTO" do pedido já estava correta e não
foi tocada.

`apps/storefront/src/pages/HomePage.tsx` · `apps/storefront/src/pages/OrderPage.tsx`

### 5. Código interno de regra na tela de acesso

"Seu perfil exige verificação em duas etapas para acessar o painel **(RN12)**".
`RN12` nomeia um requisito do documento de negócio e não diz nada a quem está
tentando entrar — numa tela de acesso, uma sigla desconhecida parece erro.

`apps/organizer/src/pages/AuthGate.tsx` · `apps/admin/src/pages/AuthGate.tsx`

---

## Validação desta rodada

Instalação limpa por `npm ci` nos dois repositórios.

| Verificação | Frontend | Backend |
|---|---|---|
| `contracts:verify` | PASSOU · 17 arquivos · `d9b4eed9cc723911…` | PASSOU · mesmo digest |
| `lint` | PASSOU | PASSOU |
| `typecheck` | PASSOU | PASSOU |
| `build` | PASSOU · 3 aplicações | PASSOU · 4 workspaces |
| `test` | PASSOU · 57/57 | PASSOU · **337/337, nenhum pulado** |

Os 337 do backend rodaram pela primeira vez neste ambiente, contra um PostgreSQL
**descartável** criado só para a sessão de validação. O PostgreSQL da máquina
não foi tocado; o Supabase histórico também não. `assert-no-skipped-tests.mjs`
confirma que nenhum teste se pulou.

> Esse banco é **bancada de teste, não configuração do projeto**. Ele não
> aparece em nenhum arquivo versionado: porta, nomes de banco e credenciais
> viveram apenas no `.env` local, que o Git ignora. Para rodar a suíte em
> qualquer máquina valem as variáveis `TEST_*_DATABASE_URL` documentadas no
> `.env.example` do backend, apontando para um banco descartável seu — nunca
> para o banco de desenvolvimento e jamais para o real.

### Navegador

Percorrido em 1440 px, com API e dados reais:

- vitrine: `/`, `/sorteios`, `/sorteio/:slug`, `/sorteio/:slug/checkout`,
  `/pedido/:id` — **fluxo completo exercitado**: seleção de 3 números → reserva
  → checkout → pedido criado, com total, numeração e prazo reais;
- grade: seleção, remoção por chip, legenda, estados RESERVADO e PENDENTE
  visualmente distintos, contador de disponíveis;
- organizador: login, cadastro de segundo fator (TOTP), visão geral, novo
  sorteio, 404 de rota inexistente;
- voltar/avançar do navegador entre detalhe e checkout.

**Não validado nesta rodada:** larguras 360/390/768/1280 — o redimensionamento
pela extensão não alterou o viewport. Resolvido na rodada 3, abaixo.

---

## Rodada 3 — responsividade medida, não presumida

Playwright instalado **fora dos dois repositórios** (bancada de sessão, não
dependência do produto), com `viewport` explícito por contexto e
`hasTouch`/`isMobile` abaixo de 768 px. Cinco larguras: **360×800, 390×844,
768×1024, 1280×800, 1440×900**.

### Overflow horizontal

Sonda em cada tela e largura comparando `scrollWidth` com `clientWidth`, e
listando o elemento causador quando houvesse diferença.

**Zero overflow** em 5 larguras × 4 telas públicas, e em todas as rotas do
organizador. Nada foi resolvido com `overflow-x: hidden` — não houve o que
esconder.

### Alvos de toque

Medição de todo controle interativo abaixo de 40 px em 360 e 390.

| Achado | Medida | Correção |
|---|---|---|
| `+1`, `+5`, `+10`, "Surpreenda-me", "Limpar" na grade | 34 px de altura | `.btn--sm` respeita `--touch-target` sob `pointer: coarse` |
| "Ver todos", demais `.btn--sm` | 34 px | idem, pela mesma regra |
| "Todos os sorteios" (voltar) | 20 px | `min-height` sob `pointer: coarse` |
| Links do rodapé | 20 px | `min-height` sob `pointer: coarse` |

A classe `.btn--sm` **já trazia no comentário** "não use em fluxo de compra no
celular" — e a barra de ferramentas da grade usava mesmo assim. Em vez de trocar
a classe em cada ponto de uso, o botão passou a respeitar o alvo onde não há
ponteiro fino. `pointer: coarse` é a pergunta certa: não "a tela é estreita", e
sim "quem aponta aqui é um dedo". Desktop estreito mantém a densidade.

Na grade de detalhe, os alvos pequenos caíram de **10 para 2**, e os dois
restantes são artefato de medição, não defeito:

- `.draw-card__link` marcava 24 px, mas estica um `::after { inset: 0 }` sobre o
  cartão inteiro. **Verificado clicando no cartão longe do texto**, nas cinco
  larguras: navega. O alvo real é o bloco.
- `.site-header__brand` tem 34 px de altura e 191 px de largura — acima do
  mínimo AA e fácil de acertar.

### Fluxos exercitados, não observados de longe

Em 360, 390, 768, 1280 e 1440, contra o banco descartável:

`home → menu móvel (Escape + foco) → catálogo → clique no cartão → detalhe →
seleção → reserva → checkout → voltar → avançar → pedido → conta`

Confirmado em cada largura:

- checkout abre no topo (`scrollY=0`, vindo de até **4238 px** rolado);
- cronômetro visível sem rolar (`y≈145–189`), com prazo do servidor (`29:59`);
- `history.scrollRestoration` permanece `"auto"` — a correção de rolagem **não**
  quebra voltar/avançar;
- seleção local não altera a contagem de disponíveis;
- o pedido não promete PIX, QR Code nem pagamento aprovado.

Organizador em todas as larguras: login, segundo fator, painel, `/sorteios`,
`/sorteios/novo`, `/equipe`, `/auditoria`, 404. Gaveta móvel move o foco para
dentro ao abrir e devolve ao botão no `Escape`.

**Formulário de novo sorteio, erro recuperável em 390 px:** mensagem por campo
("O título precisa ter pelo menos 3 caracteres."), renderizada junto do campo e
não apenas em toast, foco levado para `#campo-title`, e **o que já estava
digitado permaneceu**.

Admin em 390: login, cadastro de segundo fator, console de comunidades, 404.
Nenhum código interno `(RNxx)` visível.

### Observado de passagem

A sessão do organizador alcançou o console do admin — em `localhost` o cookie de
sessão não distingue porta. O admin **recusou corretamente**: "A conta
dona@local.test não tem privilégio de plataforma." A autorização é do servidor,
e a hierarquia apareceu exatamente onde devia. Em produção os três apps vivem em
hosts distintos e a situação não se reproduz.

### Correções desta rodada

Somente CSS, todas sob `@media (pointer: coarse)`, nenhuma alterando layout de
desktop:

- `packages/shared/styles/components.css` — `.btn--sm`
- `apps/storefront/src/styles.css` — `.back-link`, `.site-footer__nav a`

---

## Rodada 4 — Admin real, e as quatro pendências de UX

### Admin exercitado com identidade de plataforma

A rodada anterior só provou a autorização NEGATIVA: um dono de comunidade
batendo no console e sendo recusado. Faltava o fluxo positivo.

A identidade foi criada **no banco descartável**, pelo mesmo caminho que a
aplicação usa: linha em `users`, hash `scrypt` em `user_credentials` gerado por
`hashPassword()`, fator TOTP cifrado em `user_mfa_factors` com a `SecretBox` do
próprio projeto, e o privilégio explícito em `platform_admins`
(`PLATFORM_OPERATIONS`). **Nenhum atalho**: sem `if development`, sem login
mágico, sem papel embutido no código, sem e-mail especial, sem cabeçalho de
bypass. A permissão passa pela mesma matriz de sempre.

Exercitado em 390 e 1440: login, segundo fator, console, lista de comunidades,
**criação de comunidade pela interface** (duas criadas, conferidas no banco),
estado vazio, estado de erro, 404, gaveta móvel e logout.

A separação foi reconfirmada ao final: o organizador entra no próprio painel e o
console o recusa, sem expor nenhuma ação de plataforma.

### UUID do pedido

O comprovante mostrava `Código do pedido: 9eba7453-1be0-4ba5-…`. Esconder o UUID
por completo resolvia a poluição e criava outro problema: `@media print` remove
cabeçalho, rodapé e ações, e o comprovante **impresso** ficava sem
identificador nenhum — quem imprime e depois precisa casar o papel com o
registro da organização não teria por onde começar.

Agora a tela mostra `Pedido #6B799B`: os seis últimos dígitos do UUID, em
monoespaçada. É **apresentação apenas** — derivado, sem campo novo, sem contrato
novo, sem schema novo. A API continua recebendo o `orderId` completo pela URL; o
código curto nunca é enviado a lugar nenhum e não é chave de negócio. Na
impressão fica a referência e sai a dica sobre guardar o endereço, que no papel
não quer dizer nada.

### Fallback de imagem

Era uma caixa de ~450 px com borda tracejada, listras diagonais e "Foto em
breve" — dominava o detalhe e empurrava o título para baixo da dobra no celular.
Agora é uma área neutra com altura limitada (`clamp`), borda sutil, ícone menor
e "Sem imagem do prêmio". Ajustada nos três lugares onde aparece: herói da home,
cartão do catálogo e detalhe. Nenhuma imagem inventada, nenhuma foto genérica.

### Restauração de rolagem com conteúdo assíncrono

Investigado antes de mexer. Medido: rolando o catálogo até 3000 px, abrindo um
sorteio e voltando, a posição restaurada ficou em **2014–2189 px** — o navegador
devolve a uma posição útil sozinho, depois que o conteúdo estabiliza.

Não havia defeito a corrigir, então **nada foi alterado**.
`history.scrollRestoration` continua em `auto`, sem `manual` global e sem
sistema de posição por rota. A imprecisão residual fica registrada como
melhoria não bloqueante.

### `/conta`

Nenhum endpoint foi inventado e nenhuma busca por e-mail, telefone ou parâmetro
manipulável foi adicionada. A tela passou a mostrar só o que existe de fato —
perfil e sessão — com uma linha discreta orientando a guardar o endereço do
comprovante. Saiu o cartão "Suas compras" que anunciava uma ausência, e saiu
junto qualquer menção a fase, backend ou pendência técnica: isso é conversa
entre nós, não com quem está comprando.

### Validação

Instalação já existente, comandos reexecutados nos dois repositórios:

| Verificação | Frontend | Backend |
|---|---|---|
| `contracts:verify` | PASSOU · `d9b4eed9cc723911…` | PASSOU · mesmo digest |
| `lint` | PASSOU | PASSOU |
| `typecheck` | PASSOU | PASSOU |
| `build` | PASSOU | PASSOU |
| `test` | PASSOU · 57/57 | PASSOU · 337/337 |
| pulados | 0 | 0 |

17 capturas em `docs/evidencias/final-frontend-2026-09-23/`.

---

## Pendências

### Frontend
- responsividade não conferida visualmente em 360/390/768/1280.
- restauração de rolagem no POP depende de a página já ter altura; como o
  conteúdo chega por requisição, voltar para uma lista longa pode cair perto do
  topo. Resolver exige guardar posição por rota e reaplicar quando o dado chega.
- `/conta` continua sem endpoint seguro para consolidar pedidos do participante.
- sem testes de componentes React.
- imagem do prêmio: o fallback "Foto em breve" ocupa a maior área do detalhe e
  empurra o título para baixo da dobra.
- UUID do pedido exibido como "Código do pedido".

### Backend
- criação de comunidade não provisiona owner automaticamente.
- equipe sem convite/remoção.
- listagens limitadas a 200, sem paginação.

### Infraestrutura
- credencial histórica do Supabase **inválida** (`28P01` para `app_user`).
- topologia white-label de produção (host → comunidade) em aberto.

### Fase PIX/PSP
- fora do escopo desta rodada, como combinado.
