import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { api } from '../api.ts';
import { IS_CENTRAL } from '../lib/mode.ts';

/**
 * Escopo de uma comunidade DENTRO do marketplace (`/rifa/:tenantSlug/...`).
 *
 * Enquanto este componente esta montado, o cliente da API troca as chamadas da vitrine
 * (`publicDraw`, `createReservation`...) pelas variantes com a comunidade no caminho. As telas
 * continuam chamando os mesmos nomes. Ao sair, o cliente volta ao normal.
 *
 * O `useLayoutEffect` roda ANTES de qualquer `useEffect` dos filhos: nenhuma chamada sai com a
 * comunidade errada.
 */
const ScopeContext = createContext<string | null>(null);

export function MarketplaceScope({ children }: { children?: ReactNode }) {
  const { tenantSlug } = useParams();
  const slug = tenantSlug ?? null;

  useLayoutEffect(() => {
    api.setMarketplaceTenant(slug);
    return () => {
      if (api.marketplaceTenant === slug) api.setMarketplaceTenant(null);
    };
  }, [slug]);

  // Os filhos so montam depois que o cliente ja esta no escopo certo (evita uma primeira
  // renderizacao chamando a rota da comunidade errada).
  if (api.marketplaceTenant !== slug) api.setMarketplaceTenant(slug);

  return <ScopeContext.Provider value={slug}>{children ?? <Outlet />}</ScopeContext.Provider>;
}

/** Slug da comunidade do escopo atual, ou nulo fora do marketplace. */
export function useMarketplaceTenant(): string | null {
  return useContext(ScopeContext);
}

/**
 * Caminhos da vitrine. Em modo central (ou dentro de um escopo) as paginas de uma rifa vivem
 * em `/rifa/:tenantSlug/...`; no modo por comunidade, nos caminhos de sempre. Toda tela usa isto
 * em vez de montar o caminho na mao.
 */
export function useAppPaths() {
  const scoped = useContext(ScopeContext);
  const base = (tenantSlug?: string | null): string | null => {
    const slug = tenantSlug ?? scoped;
    return slug && (IS_CENTRAL || scoped) ? `/rifa/${slug}` : null;
  };
  return {
    draws: () => '/sorteios',
    draw: (drawSlug: string, tenantSlug?: string | null) => {
      const b = base(tenantSlug);
      return b ? `${b}/${drawSlug}` : `/sorteio/${drawSlug}`;
    },
    checkout: (drawSlug: string, tenantSlug?: string | null) => {
      const b = base(tenantSlug);
      return b ? `${b}/${drawSlug}/checkout` : `/sorteio/${drawSlug}/checkout`;
    },
    result: (drawSlug: string, tenantSlug?: string | null) => {
      const b = base(tenantSlug);
      return b ? `${b}/${drawSlug}/resultado` : `/sorteio/${drawSlug}/resultado`;
    },
    order: (orderId: string, tenantSlug?: string | null) => {
      const b = base(tenantSlug);
      return b ? `${b}/pedido/${orderId}` : `/pedido/${orderId}`;
    },
    creator: (tenantSlug: string) => `/criador/${tenantSlug}`,
  };
}
