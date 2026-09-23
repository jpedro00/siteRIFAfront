import { EmptyDrawState } from '../components/EmptyDrawState.tsx';
import { DrawCard } from '../components/DrawCard.tsx';
import { ErrorState } from '../components/States.tsx';
import { DrawCardSkeleton } from '../components/Skeletons.tsx';
import { useApiResource } from '../hooks/useApiResource.ts';
import { useStorefront } from '../state/SessionProvider.tsx';
import { api } from '../api.ts';

/** Listagem de todos os sorteios publicados da comunidade. */
export function DrawsPage() {
  const { tenant } = useStorefront();
  const nomeComunidade = tenant?.publicName ?? tenant?.name ?? 'esta comunidade';

  const sorteios = useApiResource(
    (signal) => api.call('publicDraws', undefined, { signal }),
    [],
  );

  return (
    <div className="container stack stack--lg page">
      <header className="page__header">
        <h1 className="page__title">Sorteios</h1>
        <p className="page__description">
          Todos os sorteios publicados por {nomeComunidade}.
        </p>
      </header>

      {sorteios.status === 'loading' && <DrawCardSkeleton count={6} />}

      {sorteios.status === 'error' && (
        <ErrorState error={sorteios.error} onRetry={sorteios.reload} />
      )}

      {sorteios.status === 'ready' &&
        (sorteios.data && sorteios.data.draws.length > 0 ? (
          <div className="draw-list">
            {sorteios.data.draws.map((draw) => (
              <DrawCard key={draw.id} draw={draw} />
            ))}
          </div>
        ) : (
          <EmptyDrawState communityName={nomeComunidade} />
        ))}
    </div>
  );
}
