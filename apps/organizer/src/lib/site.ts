/**
 * Enderecos do site publico (Storefront) a partir do painel.
 *
 * Tudo vem de CONFIGURACAO de build; nenhum dominio e escrito no codigo. Sem
 * `VITE_STOREFRONT_BASE_URL` valida, as funcoes devolvem null e a tela simplesmente nao mostra o
 * link (nunca um link quebrado).
 */
const BASE: string | null = (() => {
  const raw = import.meta.env['VITE_STOREFRONT_BASE_URL'] as string | undefined;
  return raw && /^https?:\/\//.test(raw) ? raw.replace(/\/+$/, '') : null;
})();

/** Mesmo valor que o Storefront usa: no modo central a vitrine do criador mora em /criador/:slug. */
const CENTRAL = import.meta.env['VITE_MARKETPLACE_MODE'] === 'central';

/** Pagina publica da comunidade. Em modo white-label a vitrine e a propria raiz do site. */
export function vitrineUrl(tenantSlug: string | null | undefined): string | null {
  if (!BASE) return null;
  if (!CENTRAL) return `${BASE}/`;
  return tenantSlug ? `${BASE}/criador/${encodeURIComponent(tenantSlug)}` : null;
}

/** Pagina inicial do Clube da Rifa (marketplace). So existe no modo central. */
export function clubeUrl(): string | null {
  return BASE && CENTRAL ? `${BASE}/` : null;
}

/** Recuperacao de senha: a identidade e global, entao o fluxo e o do Storefront. */
export function esqueciSenhaUrl(): string | null {
  return BASE ? `${BASE}/esqueci-senha` : null;
}

/** Criar conta / virar criador: tambem do Storefront (nao existe cadastro proprio no painel). */
export function queroCriarUrl(): string | null {
  return BASE ? `${BASE}/quero-criar-rifas` : null;
}
