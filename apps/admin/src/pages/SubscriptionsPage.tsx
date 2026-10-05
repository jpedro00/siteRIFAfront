import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import {
  formatDate,
  type BillingState,
  type PlatformSubscriptionItem,
  type PlatformSubscriptionListResponse,
} from '@clubedarifa/shared';
import { api } from '../api.ts';
import { ToneBadge } from '../components/BillingUi.tsx';
import { ErrorState, Loading } from '../components/States.tsx';
import { BILLING_STATE_VIEW, FILTERABLE_STATES } from '../lib/billingAdmin.ts';

/**
 * Assinaturas das comunidades (Fase 7). SOMENTE CONSULTA: o estado financeiro vem da Stripe,
 * e nao ha aqui nenhum botao que ative, pague ou altere uma assinatura.
 *
 * Uma linha por comunidade (a assinatura atual). Filtro por estado de negocio, busca por
 * nome ou identificador da comunidade e "Carregar mais" (paginacao por cursor).
 */
export function SubscriptionsPage() {
  const [estado, setEstado] = useState<BillingState | ''>('');
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [itens, setItens] = useState<PlatformSubscriptionItem[]>([]);
  const [proximo, setProximo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  // Descarta a resposta de uma consulta antiga (troca rapida de filtro).
  const geracao = useRef(0);

  const consulta = useCallback((cursor?: string) => {
    const minha = ++geracao.current;
    return { minha, query: { ...(estado ? { state: estado } : {}), ...(buscaAplicada ? { q: buscaAplicada } : {}), ...(cursor ? { cursor } : {}) } };
  }, [estado, buscaAplicada]);

  const carregar = useCallback(() => {
    const { minha, query } = consulta();
    setCarregando(true);
    setErro(null);
    api
      .call('platformSubscriptions', undefined, { query })
      .then((r: PlatformSubscriptionListResponse) => {
        if (minha !== geracao.current) return;
        setItens(r.subscriptions);
        setProximo(r.nextCursor);
      })
      .catch((falha: unknown) => {
        if (minha === geracao.current) setErro(falha);
      })
      .finally(() => {
        if (minha === geracao.current) setCarregando(false);
      });
  }, [consulta]);

  useEffect(carregar, [carregar]);

  const carregarMais = () => {
    if (!proximo) return;
    const { minha, query } = consulta(proximo);
    setCarregandoMais(true);
    api
      .call('platformSubscriptions', undefined, { query })
      .then((r) => {
        if (minha !== geracao.current) return;
        setItens((antes) => [...antes, ...r.subscriptions]);
        setProximo(r.nextCursor);
      })
      .catch((falha: unknown) => {
        if (minha === geracao.current) setErro(falha);
      })
      .finally(() => setCarregandoMais(false));
  };

  const buscar = (event: FormEvent) => {
    event.preventDefault();
    setBuscaAplicada(busca.trim());
  };

  return (
    <>
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Assinaturas</h1>
          <p className="page-header__description">
            Situação da assinatura de cada comunidade. Somente consulta: o estado financeiro vem da Stripe.
          </p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn--secondary" onClick={carregar} disabled={carregando}>
            <RefreshCw size={16} aria-hidden="true" />
            Atualizar
          </button>
        </div>
      </header>

      <form className="form-inline" onSubmit={buscar} role="search" aria-label="Filtrar assinaturas">
        <div className="field">
          <label className="field__label" htmlFor="filtro-estado">
            Situação
          </label>
          <select id="filtro-estado" className="field__input" value={estado} onChange={(e) => setEstado(e.target.value as BillingState | '')}>
            <option value="">Todas</option>
            {FILTERABLE_STATES.map((s) => (
              <option key={s} value={s}>
                {BILLING_STATE_VIEW[s].label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="filtro-busca">
            Comunidade
          </label>
          <input id="filtro-busca" className="field__input" type="search" placeholder="Nome ou identificador" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <button type="submit" className="btn btn--secondary">
          <Search size={16} aria-hidden="true" />
          Buscar
        </button>
      </form>

      {carregando && <Loading label="Carregando as assinaturas…" />}
      {!carregando && erro != null && <ErrorState error={erro} onRetry={carregar} />}

      {!carregando && erro == null && (
        itens.length === 0 ? (
          <div className="empty-state">
            <h2 className="empty-state__title">Nenhuma assinatura encontrada</h2>
            <p className="empty-state__text">
              {estado || buscaAplicada ? 'Nenhuma assinatura corresponde ao filtro aplicado.' : 'Quando uma comunidade contratar um plano, ela aparece aqui.'}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Assinaturas das comunidades</caption>
              <thead>
                <tr>
                  <th scope="col">Comunidade</th>
                  <th scope="col">Plano</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Renovação</th>
                  <th scope="col">Em atraso desde</th>
                  <th scope="col">Fim da tolerância</th>
                  <th scope="col">Cancelamento</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((s) => {
                  const visao = BILLING_STATE_VIEW[s.state];
                  return (
                    <tr key={s.id}>
                      <td>
                        <span className="table__primary">{s.tenantName}</span>
                        <p className="table__secondary">
                          <code className="slug">{s.tenantSlug}</code>
                        </p>
                      </td>
                      <td>
                        {s.planName}
                        <p className="table__secondary">
                          <code className="slug">{s.planCode}</code>
                        </p>
                      </td>
                      <td>
                        <ToneBadge tone={visao.tone}>{visao.label}</ToneBadge>
                        <p className="table__secondary">Stripe: {s.status}</p>
                      </td>
                      <td>{formatDate(s.currentPeriodEnd) ?? '—'}</td>
                      <td>{formatDate(s.pastDueSince) ?? '—'}</td>
                      <td>{formatDate(s.graceEndsAt) ?? '—'}</td>
                      <td>{s.cancelAtPeriodEnd ? 'Agendado' : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {!carregando && proximo && (
        <button type="button" className="btn btn--secondary" disabled={carregandoMais} onClick={carregarMais}>
          {carregandoMais ? 'Carregando…' : 'Carregar mais'}
        </button>
      )}
    </>
  );
}
