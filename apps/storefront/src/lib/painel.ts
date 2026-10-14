import type { MembershipSummary, SessionResponse } from '@clubedarifa/shared';
import { ORGANIZER_URL } from './mode.ts';

/**
 * Comunidades em que a pessoa e OWNER. Vem da propria sessao (`memberships`): nao ha endpoint
 * novo e "criador" nao e outro tipo de usuario, so uma conta com esse vinculo.
 */
export function comunidadesDoCriador(session: Pick<SessionResponse, 'memberships'> | null | undefined): MembershipSummary[] {
  return session?.memberships.filter((m) => m.roles.includes('OWNER')) ?? [];
}

/**
 * Link para o painel do criador (Organizer). Sem slug, abre o painel e deixa o seletor de
 * comunidade dele decidir: nunca se escolhe uma comunidade arbitraria quando ha varias.
 * Devolve null se `VITE_ORGANIZER_BASE_URL` nao estiver configurada (a tela explica, sem link quebrado).
 */
export function painelUrl(slug?: string): string | null {
  if (!ORGANIZER_URL) return null;
  return slug ? `${ORGANIZER_URL}/?comunidade=${encodeURIComponent(slug)}` : `${ORGANIZER_URL}/`;
}

/** Destino do "Meu painel": a comunidade, se for uma so; senao o seletor do painel. */
export function painelUrlDoCriador(donas: readonly MembershipSummary[]): string | null {
  if (donas.length === 0) return null;
  return painelUrl(donas.length === 1 ? donas[0]!.tenantSlug : undefined);
}
