/**
 * Dois modos da MESMA vitrine, escolhidos no build:
 *
 *   tenant   (padrao) · vitrine white-label de UMA comunidade, resolvida pelo dominio. E o que
 *                       cada comunidade com dominio proprio/subdominio continua usando.
 *   central           · o Clube da Rifa: marketplace com as rifas de TODOS os criadores. A
 *                       comunidade de cada rifa vem do CAMINHO (`/rifa/:tenantSlug/...`), nunca
 *                       de cabecalho.
 *
 * Os dois coexistem: o isolamento por comunidade (RLS) e a vitrine por dominio nao mudam.
 */
export const IS_CENTRAL = import.meta.env['VITE_MARKETPLACE_MODE'] === 'central';

/** Painel do criador (Organizer), para onde o onboarding leva depois de criar a comunidade. */
export const ORGANIZER_URL: string | null = (() => {
  const raw = import.meta.env['VITE_ORGANIZER_BASE_URL'] as string | undefined;
  return raw && /^https?:\/\//.test(raw) ? raw.replace(/\/+$/, '') : null;
})();

/** Slug da comunidade dona das URLs antigas `/sorteio/:slug` (links ja compartilhados). */
export const LEGACY_TENANT_SLUG: string | null = (() => {
  const raw = import.meta.env['VITE_LEGACY_TENANT_SLUG'] as string | undefined;
  return raw && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(raw) ? raw : null;
})();

export const PLATFORM_NAME = 'Clube da Rifa';
