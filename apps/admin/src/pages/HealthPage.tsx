import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { formatDateTime, type PlatformHealthResponse } from '@clubedarifa/shared';
import { api } from '../api.ts';
import { ToneBadge } from '../components/BillingUi.tsx';
import { ErrorState, Loading } from '../components/States.tsx';
import { JOB_DESCRIPTIONS } from '../lib/billingAdmin.ts';

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
                <td className="table__primary">
                  {j.name}
                  {JOB_DESCRIPTIONS[j.name] && <p className="table__secondary">{JOB_DESCRIPTIONS[j.name]}</p>}
                </td>
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

      <FinancialHealth data={data} />

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

/** Um indicador com contagem: a etiqueta diz a situacao em texto, nao so na cor. */
function Indicator({ label, value, warn }: { label: string; value: number; warn: boolean }) {
  return (
    <div className="row row--between">
      <dt>{label}</dt>
      <dd>
        <span className="tabular">{value}</span>{' '}
        <ToneBadge tone={warn ? 'warning' : 'success'}>{warn ? 'Atenção' : 'Em ordem'}</ToneBadge>
      </dd>
    </div>
  );
}

/**
 * Fase 7: cobranca da plataforma (Stripe) e recebimentos por comunidade (Mercado Pago).
 * Somente contagens e referencias curtas — nenhuma credencial, nenhum payload cru.
 */
function FinancialHealth({ data }: { data: PlatformHealthResponse }) {
  const stripe = data.stripeEvents;
  const pay = data.paymentAccounts;
  return (
    <>
      <section className="card" style={{ marginTop: 24 }} aria-labelledby="saude-stripe">
        <div className="card__header">
          <h2 className="card__title" id="saude-stripe">
            Cobrança das assinaturas (Stripe)
          </h2>
        </div>
        <div className="card__body">
          <dl className="stack stack--sm">
            <Indicator label="Eventos com falha (serão reprocessados)" value={stripe.failed} warn={stripe.failed > 0} />
            <Indicator label="Eventos mortos (precisam de inspeção)" value={stripe.dead} warn={stripe.dead > 0} />
            <div className="row row--between">
              <dt>Eventos recebidos aguardando processamento</dt>
              <dd className="tabular">{stripe.pending}</dd>
            </div>
            {stripe.oldestProblemAt && (
              <div className="row row--between">
                <dt>Problema mais antigo</dt>
                <dd>{formatDateTime(stripe.oldestProblemAt)}</dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      <section className="card" style={{ marginTop: 24 }} aria-labelledby="saude-recebimentos">
        <div className="card__header">
          <h2 className="card__title" id="saude-recebimentos">
            Recebimentos das comunidades (Mercado Pago)
          </h2>
        </div>
        <div className="card__body stack">
          <dl className="stack stack--sm">
            <Indicator label="Autorizações com erro" value={pay.authorizationsError} warn={pay.authorizationsError > 0} />
            <Indicator label="Autorizações revogadas" value={pay.authorizationsRevoked} warn={pay.authorizationsRevoked > 0} />
            <div className="row row--between">
              <dt>Contas desconectando (aguardando operações em andamento)</dt>
              <dd className="tabular">{pay.accountsDisconnecting}</dd>
            </div>
            <Indicator
              label="Pagamentos sem como consultar (autorização indisponível)"
              value={pay.unavailableIssues.count}
              warn={pay.unavailableIssues.count > 0}
            />
          </dl>

          {pay.unavailableIssues.items.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Pagamentos com autorização indisponível</caption>
                <thead>
                  <tr>
                    <th scope="col">Comunidade</th>
                    <th scope="col">Referência</th>
                    <th scope="col">Detectado em</th>
                    <th scope="col">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {pay.unavailableIssues.items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <span className="table__primary">{i.tenantName}</span>
                        <p className="table__secondary">
                          <code className="slug">{i.tenantSlug}</code>
                        </p>
                      </td>
                      <td>
                        <code className="slug">{i.reference}</code>
                      </td>
                      <td>{formatDateTime(i.detectedAt)}</td>
                      <td>
                        <ToneBadge tone="danger">Em aberto · ação manual</ToneBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pay.unavailableIssues.count > pay.unavailableIssues.items.length && (
            <p className="muted">Mostrando as {pay.unavailableIssues.items.length} mais antigas de {pay.unavailableIssues.count}.</p>
          )}
        </div>
      </section>
    </>
  );
}
