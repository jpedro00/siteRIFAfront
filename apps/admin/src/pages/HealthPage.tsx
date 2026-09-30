import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { formatDateTime, type PlatformHealthResponse } from '@clubedarifa/shared';
import { api } from '../api.ts';
import { ErrorState, Loading } from '../components/States.tsx';

/**
 * Saude da plataforma: ultimo ciclo de cada job, fila de mortos (dead-letter),
 * backlog da outbox e pendencias de conciliacao. So leitura.
 */
export function HealthPage() {
  const [data, setData] = useState<PlatformHealthResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .call('platformHealth')
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  if (loading && !data) return <Loading label="Carregando a saúde…" />;
  if (error != null) return <ErrorState error={error} onRetry={load} />;
  if (!data) return null;

  const workerTexto = { ok: 'Em dia', stale: 'Atrasado', unknown: 'Sem histórico' }[data.worker];

  return (
    <>
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Saúde</h1>
          <p className="page-header__description">
            Worker: <strong>{workerTexto}</strong> · gerado em {formatDateTime(data.generatedAt)}
          </p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn--secondary" onClick={load} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" />
            Atualizar
          </button>
        </div>
      </header>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Job</th>
              <th scope="col">Último sucesso</th>
              <th scope="col" className="table__num">
                Duração
              </th>
              <th scope="col" className="table__num">
                Itens
              </th>
              <th scope="col">Situação</th>
            </tr>
          </thead>
          <tbody>
            {data.jobs.map((j) => (
              <tr key={j.name}>
                <td className="table__primary">{j.name}</td>
                <td>{j.lastSuccessAt ? formatDateTime(j.lastSuccessAt) : '—'}</td>
                <td className="table__num">{j.lastDurationMs === null ? '—' : `${j.lastDurationMs} ms`}</td>
                <td className="table__num">{j.lastCount ?? '—'}</td>
                <td>
                  {j.stale ? 'Atrasado' : j.consecutiveFailures > 0 ? `${j.consecutiveFailures} falhas seguidas` : 'Ok'}
                  {j.lastError && <p className="table__secondary">{j.lastError}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="card" style={{ marginTop: 24 }}>
        <div className="card__body">
          <dl>
            <dt>Eventos mortos (dead-letter)</dt>
            <dd>
              {data.deadLetter.count}
              {data.deadLetter.oldestAt ? ` · mais antigo ${formatDateTime(data.deadLetter.oldestAt)}` : ''}
            </dd>
            <dt>Outbox pendente</dt>
            <dd>
              {data.outboxPending.count}
              {data.outboxPending.oldestAt ? ` · mais antigo ${formatDateTime(data.outboxPending.oldestAt)}` : ''}
            </dd>
            <dt>Conciliação: pendências abertas</dt>
            <dd>{data.reconciliation.openIssues}</dd>
            <dt>Devoluções manuais</dt>
            <dd>{data.reconciliation.manualRefunds}</dd>
          </dl>
        </div>
      </section>
    </>
  );
}
