import { ApiClient, detectTenantSlug, resolveApiBaseUrl } from '@clubedarifa/shared';

/**
 * Cliente da API.
 *
 * A comunidade e resolvida pelo SERVIDOR, a partir do dominio. O slug so viaja
 * do navegador quando o app roda em localhost, onde nao ha subdominio por
 * comunidade — e a API so o aceita com `TENANT_HEADER_ENABLED` ligado, o que
 * a configuracao recusa em producao. Em nenhum caso o cliente envia um
 * tenant_id: o identificador sai do banco e o vinculo e conferido la.
 *
 * A REGRA de onde o slug vem mora em `@clubedarifa/shared` e tem teste proprio;
 * aqui fica so a leitura do navegador.
 */
const STORAGE_KEY = 'tenantSlug';

function readStoredSlug(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Navegacao privada ou armazenamento bloqueado: seguir sem memoria e
    // melhor do que quebrar a pagina inteira.
    return null;
  }
}

/**
 * Comunidade ESCOLHIDA pelo criador (Organizer central: um dominio so para todos). Guarda so o
 * SLUG; nunca um tenant_id. Quem decide se a pessoa pode operar nela e o servidor (vinculo).
 */
const SELECTED_KEY = 'selectedCommunity';
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function readSelectedCommunity(): string | null {
  try {
    const v = window.localStorage.getItem(SELECTED_KEY);
    return v && SLUG_RE.test(v) ? v : null;
  } catch {
    return null;
  }
}

export function storeSelectedCommunity(slug: string | null): void {
  try {
    if (slug && SLUG_RE.test(slug)) window.localStorage.setItem(SELECTED_KEY, slug);
    else window.localStorage.removeItem(SELECTED_KEY);
  } catch {
    /* sem memoria disponivel: a escolha vale so ate recarregar */
  }
}

function resolveTenantSlug(): string | null {
  // 1) `?comunidade=slug` (link vindo do onboarding); 2) escolha guardada; 3) heuristica antiga.
  const pedida = new URLSearchParams(window.location.search).get('comunidade')?.trim().toLowerCase();
  if (pedida && SLUG_RE.test(pedida)) {
    storeSelectedCommunity(pedida);
    return pedida;
  }
  const escolhida = readSelectedCommunity();
  if (escolhida) return escolhida;

  const decision = detectTenantSlug({
    hostname: window.location.hostname,
    search: window.location.search,
    storedSlug: readStoredSlug(),
  });

  // O parametro `?tenant=` some na navegacao seguinte; memorizar e o que
  // mantem a escolha valendo durante a sessao de desenvolvimento.
  if (decision.source === 'query' && decision.slug) {
    try {
      window.localStorage.setItem(STORAGE_KEY, decision.slug);
    } catch {
      /* sem memoria disponivel; o parametro continua funcionando na URL */
    }
  }
  return decision.slug;
}

export const apiBaseUrl = resolveApiBaseUrl(
  import.meta.env['VITE_API_BASE_URL'] as string | undefined,
  { production: import.meta.env.PROD },
);

export const api = new ApiClient({ baseUrl: apiBaseUrl, tenantSlug: resolveTenantSlug() });

export function setTenantSlug(slug: string | null): void {
  try {
    if (slug) window.localStorage.setItem(STORAGE_KEY, slug);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* sem memoria disponivel */
  }
  api.setTenantSlug(slug);
}
