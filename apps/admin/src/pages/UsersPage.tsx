import { useState, type FormEvent } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { formatDate } from '@clubedarifa/shared';
import { api } from '../api.ts';
import { ErrorState } from '../components/States.tsx';
import { useCursorList } from '../hooks/useCursorList.ts';

/**
 * Usuarios da plataforma. Somente leitura.
 *
 * Mostra quem a conta e (nome, e-mail, situacao), quantos vinculos com comunidades e quantos
 * pedidos ela tem, e os papeis de plataforma. Nunca ha credencial, segredo de MFA ou sessao:
 * a API nao os devolve. A rota exige `platform:user:read` e MFA.
 */
const PAPEIS: Record<string, string> = {
  PLATFORM_OPERATIONS: 'Operações',
  PLATFORM_COMPLIANCE: 'Compliance',
  PLATFORM_RISK: 'Risco',
  PLATFORM_SUPPORT: 'Suporte',
  PLATFORM_FINANCE: 'Financeiro',
};

export function UsersPage() {
  const [digitado, setDigitado] = useState('');
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');

  const lista = useCursorList(
    async (cursor) => {
      const query: Record<string, string> = {};
      if (busca) query['q'] = busca;
      if (status) query['status'] = status;
      if (cursor) query['cursor'] = cursor;
      const r = await api.call('platformUsers', undefined, { query });
      return { items: r.users, nextCursor: r.nextCursor };
    },
    [busca, status],
  );

  function pesquisar(event: FormEvent) {
    event.preventDefault();
    setBusca(digitado.trim());
  }

  return (
    <>
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Usuários</h1>
          <p className="page-header__description">
            Contas da plataforma. A identidade é única: participantes, criadores e equipe usam a mesma conta.
          </p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn--secondary" onClick={lista.reload} disabled={lista.loading}>
            <RefreshCw size={16} aria-hidden="true" />
            Atualizar
          </button>
        </div>
      </header>

      <form className="row" onSubmit={pesquisar} role="search" style={{ marginBottom: 16, gap: 8 }}>
        <label className="sr-only" htmlFor="busca-usuarios">
          Buscar por nome ou e-mail
        </label>
        <input
          id="busca-usuarios"
          className="input"
          type="search"
          placeholder="Buscar por nome ou e-mail"
          value={digitado}
          maxLength={100}
          onChange={(e) => setDigitado(e.target.value)}
        />
        <label className="sr-only" htmlFor="filtro-situacao">
          Situação
        </label>
        <select id="filtro-situacao" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todas as situações</option>
          <option value="ACTIVE">Ativas</option>
          <option value="DISABLED">Desativadas</option>
        </select>
        <button type="submit" className="btn btn--primary">
          <Search size={16} aria-hidden="true" />
          Buscar
        </button>
      </form>

      {lista.loading && <p role="status">Carregando os usuários…</p>}
      {!lista.loading && lista.error != null && <ErrorState error={lista.error} onRetry={lista.reload} />}

      {!lista.loading &&
        lista.error == null &&
        (lista.items.length === 0 ? (
          <p className="muted">Nenhum usuário encontrado.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">E-mail</th>
                  <th scope="col">Situação</th>
                  <th scope="col" className="table__num">
                    Comunidades
                  </th>
                  <th scope="col" className="table__num">
                    Pedidos
                  </th>
                  <th scope="col">Plataforma</th>
                  <th scope="col">Criada em</th>
                </tr>
              </thead>
              <tbody>
                {lista.items.map((u) => (
                  <tr key={u.id}>
                    <td className="table__primary">{u.displayName}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge ${u.status === 'ACTIVE' ? 'badge--success' : 'badge--neutral'}`}>
                        <span className="badge__dot" aria-hidden="true" />
                        {u.status === 'ACTIVE' ? 'Ativa' : 'Desativada'}
                      </span>
                    </td>
                    <td className="table__num">{u.membershipsCount}</td>
                    <td className="table__num">{u.ordersCount}</td>
                    <td>{u.platformRoles.length === 0 ? '—' : u.platformRoles.map((p) => PAPEIS[p] ?? p).join(', ')}</td>
                    <td>{formatDate(u.createdAt) ?? '—'}</td>
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
