import { useState, type FormEvent } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { formatDate } from '@clubedarifa/shared';
import { api } from '../api.ts';
import { ErrorState } from '../components/States.tsx';
import { useCursorList } from '../hooks/useCursorList.ts';

/**
 * Criadores: visao das comunidades que tem dono, com plano, situacao da assinatura, situacao da
 * conta de recebimento e quantidade de rifas. "Criador" nao e outro tipo de usuario: e a mesma
 * conta global com vinculo OWNER numa comunidade. So o ESTADO da conta de recebimento aparece,
 * nunca token ou chave.
 */
const BASE = (import.meta.env['VITE_STOREFRONT_BASE_URL'] as string | undefined)?.replace(/\/+$/, '');
const ORGANIZER = (import.meta.env['VITE_ORGANIZER_BASE_URL'] as string | undefined)?.replace(/\/+$/, '');
const CENTRAL = import.meta.env['VITE_MARKETPLACE_MODE'] === 'central';

const ASSINATURA: Record<string, string> = {
  active: 'Ativa',
  trialing: 'Em teste',
  past_due: 'Pagamento em atraso',
  unpaid: 'Não paga',
  paused: 'Pausada',
  canceled: 'Cancelada',
  incomplete: 'Incompleta',
  incomplete_expired: 'Expirada',
};
const RECEBIMENTO: Record<string, string> = {
  CONNECTED: 'Conectada',
  DISCONNECTING: 'Desconectando',
  DISCONNECTED: 'Desconectada',
  ERROR: 'Com erro',
};

export function CreatorsPage() {
  const [digitado, setDigitado] = useState('');
  const [busca, setBusca] = useState('');

  const lista = useCursorList(
    async (cursor) => {
      const query: Record<string, string> = {};
      if (busca) query['q'] = busca;
      if (cursor) query['cursor'] = cursor;
      const r = await api.call('platformCreators', undefined, { query });
      return { items: r.creators, nextCursor: r.nextCursor };
    },
    [busca],
  );

  function pesquisar(event: FormEvent) {
    event.preventDefault();
    setBusca(digitado.trim());
  }

  const mostraVitrine = Boolean(BASE) && CENTRAL;

  return (
    <>
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Criadores</h1>
          <p className="page-header__description">Comunidades com dono: plano, recebimento e rifas públicas.</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn--secondary" onClick={lista.reload} disabled={lista.loading}>
            <RefreshCw size={16} aria-hidden="true" />
            Atualizar
          </button>
        </div>
      </header>

      <form className="row" onSubmit={pesquisar} role="search" style={{ marginBottom: 16, gap: 8 }}>
        <label className="sr-only" htmlFor="busca-criadores">
          Buscar por nome ou endereço da comunidade
        </label>
        <input
          id="busca-criadores"
          className="input"
          type="search"
          placeholder="Buscar por nome ou endereço"
          value={digitado}
          maxLength={100}
          onChange={(e) => setDigitado(e.target.value)}
        />
        <button type="submit" className="btn btn--primary">
          <Search size={16} aria-hidden="true" />
          Buscar
        </button>
      </form>

      {lista.loading && <p role="status">Carregando os criadores…</p>}
      {!lista.loading && lista.error != null && <ErrorState error={lista.error} onRetry={lista.reload} />}

      {!lista.loading &&
        lista.error == null &&
        (lista.items.length === 0 ? (
          <p className="muted">Nenhum criador encontrado.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Comunidade</th>
                  <th scope="col">Donos</th>
                  <th scope="col">Plano</th>
                  <th scope="col">Recebimento</th>
                  <th scope="col" className="table__num">
                    Rifas públicas
                  </th>
                  <th scope="col">Criada em</th>
                  <th scope="col">Links</th>
                </tr>
              </thead>
              <tbody>
                {lista.items.map((c) => (
                  <tr key={c.tenantId}>
                    <td className="table__primary">
                      {c.name}
                      <br />
                      <code className="slug">{c.slug}</code>
                    </td>
                    <td>
                      {c.owners.map((o) => (
                        <div key={o.userId}>
                          {o.displayName} <span className="muted">{o.email}</span>
                        </div>
                      ))}
                    </td>
                    <td>
                      {c.planName ?? '—'}
                      {c.subscriptionStatus && (
                        <>
                          <br />
                          <span className="muted">{ASSINATURA[c.subscriptionStatus] ?? c.subscriptionStatus}</span>
                        </>
                      )}
                    </td>
                    <td>
                      {c.paymentAccountStatus ? (RECEBIMENTO[c.paymentAccountStatus] ?? c.paymentAccountStatus) : 'Não conectado'}
                    </td>
                    <td className="table__num">
                      {c.publicDraws} <span className="muted">({c.activeDraws} ativas)</span>
                    </td>
                    <td>{formatDate(c.createdAt) ?? '—'}</td>
                    <td>
                      {mostraVitrine && (
                        <a href={`${BASE}/criador/${encodeURIComponent(c.slug)}`} target="_blank" rel="noopener noreferrer">
                          Vitrine
                        </a>
                      )}
                      {mostraVitrine && ORGANIZER && ' · '}
                      {ORGANIZER && (
                        <a href={`${ORGANIZER}/?comunidade=${encodeURIComponent(c.slug)}`} target="_blank" rel="noopener noreferrer">
                          Painel
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {!lista.loading && lista.next && (
        <button type="button" className="btn btn--secondary" disabled={lista.loadingMore} onClick={lista.loadMore}>
          {lista.loadingMore ? 'Carregando…' : 'Carregar mais'}
        </button>
      )}
    </>
  );
}
