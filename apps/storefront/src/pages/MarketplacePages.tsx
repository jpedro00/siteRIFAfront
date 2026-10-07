import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Search, Sparkles, Store } from 'lucide-react';
import {
  type MarketplaceCreator,
  type MarketplaceCreatorProfile,
  type MarketplaceDraw,
} from '@clubedarifa/shared';
import { api } from '../api.ts';
import { DrawCard } from '../components/DrawCard.tsx';
import { DrawCardSkeleton } from '../components/Skeletons.tsx';
import { ErrorState, NotFoundState } from '../components/States.tsx';
import { useApiResource } from '../hooks/useApiResource.ts';
import { useDocumentMeta } from '../hooks/useDocumentMeta.ts';
import { imageSrc } from '../lib/brand.ts';
import { PLATFORM_NAME } from '../lib/mode.ts';

/**
 * Marketplace do Clube da Rifa: rifas de TODOS os criadores. Cada cartao leva ao detalhe
 * `/rifa/:tenantSlug/:slug`; a comunidade de cada rifa vem do caminho.
 */

function SearchBox({ initial, onSubmit }: { initial: string; onSubmit: (q: string) => void }) {
  const [q, setQ] = useState(initial);
  useEffect(() => setQ(initial), [initial]);
  function enviar(event: FormEvent) {
    event.preventDefault();
    onSubmit(q.trim());
  }
  return (
    <form className="market-search" role="search" onSubmit={enviar}>
      <label className="sr-only" htmlFor="market-search-input">
        Buscar rifas ou criadores
      </label>
      <Search size={18} aria-hidden="true" />
      <input
        id="market-search-input"
        className="market-search__input"
        type="search"
        placeholder="Buscar rifa, prêmio ou criador"
        maxLength={80}
        value={q}
        onChange={(event) => setQ(event.target.value)}
      />
      <button type="submit" className="btn btn--primary btn--sm">
        Buscar
      </button>
    </form>
  );
}

/** Lista paginada por cursor, com busca. Recarrega do comeco quando a busca muda. */
function usePagedDraws(search: string, fetchPage: (q: string, cursor: string | null) => Promise<{ draws: MarketplaceDraw[]; nextCursor: string | null }>) {
  const [draws, setDraws] = useState<MarketplaceDraw[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const geracao = useRef(0);

  const load = useCallback(
    async (cursor: string | null) => {
      const minha = ++geracao.current;
      setLoading(true);
      setError(null);
      try {
        const r = await fetchPage(search, cursor);
        if (minha !== geracao.current) return;
        setDraws((antes) => (cursor === null ? r.draws : [...antes, ...r.draws]));
        setNext(r.nextCursor);
      } catch (e) {
        if (minha === geracao.current) setError(e);
      } finally {
        if (minha === geracao.current) setLoading(false);
      }
    },
    [fetchPage, search],
  );
  useEffect(() => {
    void load(null);
  }, [load]);
  return { draws, next, loading, error, more: () => void load(next), reload: () => void load(null) };
}

const fetchAllDraws = (q: string, cursor: string | null) =>
  api.call('marketplaceDraws', undefined, { query: { search: q || undefined, cursor: cursor ?? undefined, limit: 24 } });

function DrawGrid({ draws }: { draws: MarketplaceDraw[] }) {
  return (
    <div className="draw-list">
      {draws.map((d) => (
        <DrawCard key={d.id} draw={d} tenantSlug={d.tenantSlug} creatorName={d.tenantName} />
      ))}
    </div>
  );
}

function CreatorCard({ c }: { c: MarketplaceCreator }) {
  const logo = imageSrc(c.logoUrl);
  return (
    <li className="creator-card card card--interactive">
      <div className="card__body row">
        {logo ? <img className="creator-card__logo" src={logo} alt="" /> : <span className="creator-card__logo creator-card__logo--empty" aria-hidden="true"><Store size={18} /></span>}
        <div>
          <Link className="creator-card__name draw-card__link" to={`/criador/${c.slug}`}>
            {c.name}
          </Link>
          <p className="muted">
            {c.activeDraws > 0 ? `${c.activeDraws} rifa(s) com vendas abertas` : `${c.publicDraws} rifa(s) publicada(s)`}
          </p>
        </div>
      </div>
    </li>
  );
}

/** Home do Clube da Rifa. */
export function MarketplaceHomePage() {
  const navigate = useNavigate();
  useDocumentMeta({ title: `${PLATFORM_NAME} · rifas de vários criadores`, description: 'Encontre rifas de criadores verificados, reserve seus números e pague por PIX.' });

  const destaques = useApiResource((signal) => api.call('marketplaceDraws', undefined, { query: { limit: 6 }, signal }), []);
  const criadores = useApiResource((signal) => api.call('marketplaceCreators', undefined, { query: { limit: 8 }, signal }), []);

  return (
    <div className="home">
      <section className="container market-hero">
        <p className="eyebrow">
          <Sparkles size={14} aria-hidden="true" /> {PLATFORM_NAME}
        </p>
        <h1 className="market-hero__title">Rifas de criadores de todo o Brasil, num só lugar</h1>
        <p className="market-hero__lead">Escolha seus números, reserve por 30 minutos e pague por PIX. Cada criador recebe direto na própria conta.</p>
        <SearchBox initial="" onSubmit={(q) => navigate(q ? `/sorteios?q=${encodeURIComponent(q)}` : '/sorteios')} />
        <p>
          <Link className="btn btn--secondary" to="/quero-criar-rifas">
            Quero criar rifas
          </Link>
        </p>
      </section>

      <section className="container home__section" aria-labelledby="mk-destaques">
        <div className="section__head">
          <h2 id="mk-destaques" className="home__section-title">
            Rifas em destaque
          </h2>
          <Link className="btn btn--ghost btn--sm" to="/sorteios">
            Ver todas <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        {destaques.status === 'loading' && <DrawCardSkeleton count={3} />}
        {destaques.status === 'error' && <ErrorState error={destaques.error} onRetry={destaques.reload} />}
        {destaques.status === 'ready' &&
          (destaques.data && destaques.data.draws.length > 0 ? (
            <DrawGrid draws={destaques.data.draws} />
          ) : (
            <p className="muted">Ainda não há rifas publicadas. Volte em breve ou publique a sua.</p>
          ))}
      </section>

      {criadores.status === 'ready' && criadores.data && criadores.data.creators.length > 0 && (
        <section className="container home__section" aria-labelledby="mk-criadores">
          <div className="section__head">
            <h2 id="mk-criadores" className="home__section-title">
              Criadores
            </h2>
          </div>
          <ul className="creator-list">
            {criadores.data.creators.map((c) => (
              <CreatorCard key={c.slug} c={c} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Todas as rifas publicas, com busca e "carregar mais". */
export function MarketplaceDrawsPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  useDocumentMeta({ title: `Rifas · ${PLATFORM_NAME}`, description: null });
  const lista = usePagedDraws(q, fetchAllDraws);

  return (
    <div className="container stack stack--lg page">
      <header className="page__header">
        <h1 className="page__title">Rifas</h1>
        <p className="page__description">Todas as rifas publicadas pelos criadores do {PLATFORM_NAME}.</p>
      </header>
      <SearchBox initial={q} onSubmit={(novo) => setParams(novo ? { q: novo } : {})} />

      {lista.error != null && <ErrorState error={lista.error} onRetry={lista.reload} />}
      {lista.loading && lista.draws.length === 0 && lista.error == null && <DrawCardSkeleton count={6} />}
      {!lista.loading && lista.draws.length === 0 && lista.error == null && (
        <p className="muted">{q ? 'Nenhuma rifa encontrada para essa busca.' : 'Ainda não há rifas publicadas.'}</p>
      )}
      {lista.draws.length > 0 && <DrawGrid draws={lista.draws} />}
      {lista.next && !lista.loading && (
        <button type="button" className="btn btn--secondary" onClick={lista.more}>
          Carregar mais
        </button>
      )}
    </div>
  );
}

/** Perfil publico do criador. */
export function CreatorPage() {
  const { tenantSlug = '' } = useParams<{ tenantSlug: string }>();
  const perfil = useApiResource<MarketplaceCreatorProfile>(
    (signal) => api.call('marketplaceCreator', undefined, { params: { tenantSlug }, signal }),
    [tenantSlug],
  );
  useDocumentMeta({ title: perfil.data ? `${perfil.data.creator.name} · ${PLATFORM_NAME}` : PLATFORM_NAME, description: perfil.data?.creator.description ?? null });

  if (perfil.status === 'loading') {
    return (
      <div className="container page">
        <DrawCardSkeleton count={3} />
      </div>
    );
  }
  if (perfil.status === 'error' || !perfil.data) {
    const naoEncontrado = (perfil.error as { status?: number } | null)?.status === 404;
    return (
      <div className="container page">
        {naoEncontrado ? (
          <NotFoundState title="Criador não encontrado" message="Este criador não existe ou não está ativo." action={<Link className="btn btn--primary" to="/sorteios">Ver todas as rifas</Link>} />
        ) : (
          <ErrorState error={perfil.error} onRetry={perfil.reload} />
        )}
      </div>
    );
  }

  const { creator, draws } = perfil.data;
  const logo = imageSrc(creator.logoUrl);
  const banner = imageSrc(creator.bannerUrl);
  return (
    <div className="container stack stack--lg page">
      {banner && <img className="draw-banner" src={banner} alt="" />}
      <header className="creator-header">
        {logo && <img className="creator-header__logo" src={logo} alt="" />}
        <div>
          <h1 className="page__title">{creator.name}</h1>
          {creator.description && <p className="page__description">{creator.description}</p>}
        </div>
      </header>
      {draws.length > 0 ? <DrawGrid draws={draws} /> : <p className="muted">Este criador ainda não tem rifas publicadas.</p>}
    </div>
  );
}
