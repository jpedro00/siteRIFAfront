/**
 * Endereco de um sorteio NA VITRINE, montado a partir do painel.
 *
 * O PROBLEMA QUE ISTO RESOLVE
 * ---------------------------
 * Painel e vitrine sao aplicacoes separadas, em dominios separados. Um link
 * relativo (`/sorteio/abc`) escrito no painel resolve contra o dominio DO
 * PAINEL, onde essa rota nao existe — e o roteador devolve a pessoa ao
 * dashboard sem dizer nada. O link precisa ser ABSOLUTO, e a base so pode vir
 * de configuracao: o dominio da vitrine nao esta no codigo.
 *
 * POR QUE DEVOLVE `null` EM VEZ DE UM PADRAO
 * ------------------------------------------
 * Sem base configurada nao existe resposta correta. Um fallback para
 * `localhost` funcionaria na maquina de quem desenvolve e viraria um link
 * morto em producao — a pior combinacao possivel, porque passa pelos testes
 * manuais e falha no cliente. `null` e o sinal para a interface ESCONDER o
 * botao, que e a unica saida honesta.
 *
 * A base tambem precisa ser ABSOLUTA e http(s). Uma configuracao com valor
 * relativo recriaria exatamente o defeito original, so que com um arquivo de
 * ambiente por cima disfarcando a causa.
 */

/** Esquemas aceitos. Qualquer outro (`javascript:`, `data:`) e recusado. */
const ESQUEMAS = new Set(['http:', 'https:']);

/**
 * Normaliza a base: remove barras finais e recusa o que nao serve.
 * Devolve `null` quando nao ha base utilizavel.
 */
export function normalizeStorefrontBaseUrl(raw: string | null | undefined): string | null {
  const valor = (raw ?? '').trim();
  if (valor === '') return null;

  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    // Valor relativo ou malformado: recusar em vez de concatenar e produzir
    // um endereco que parece certo e aponta para o lugar errado.
    return null;
  }

  if (!ESQUEMAS.has(url.protocol)) return null;

  // `origin` + caminho, sem barra final. Preserva subcaminho
  // (`https://exemplo.com/loja`) para instalacoes que nao vivem na raiz.
  const caminho = url.pathname.replace(/\/+$/, '');
  return `${url.origin}${caminho}`;
}

/**
 * Monta `<base>/sorteio/<slug>`.
 *
 * Devolve `null` se a base nao for utilizavel ou o slug estiver vazio — quem
 * chama esconde o link nesse caso.
 */
export function storefrontDrawUrl(
  baseUrl: string | null | undefined,
  slug: string | null | undefined,
): string | null {
  const base = normalizeStorefrontBaseUrl(baseUrl);
  if (base === null) return null;

  const limpo = (slug ?? '').trim();
  if (limpo === '') return null;

  // `encodeURIComponent` no segmento: um slug com caractere inesperado nao
  // pode escapar do caminho e virar outra rota.
  return `${base}/sorteio/${encodeURIComponent(limpo)}`;
}
