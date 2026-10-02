import { useCallback, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCents, formatDateTime, type TenantBuyer } from '@clubedarifa/shared';
import { api } from '../api.ts';
import { EmptyState, ErrorPanel, PageHeader, TableSkeleton } from '../components/Ui.tsx';

/**
 * Clientes: quem comprou na comunidade, com busca por nome, telefone ou e-mail e o resumo
 * dos pedidos. So para quem pode ver o dado completo do comprador (o servidor confere).
 */
export function ClientsPage() {
  const [busca, setBusca] = useState('');
  const [termo, setTermo] = useState('');
  const [clientes, setClientes] = useState<TenantBuyer[]>([]);
  const [proximo, setProximo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<unknown>(null);
  const geracao = useRef(0);

  const carregar = useCallback(async (cursor: string | null, q: string) => {
    const minha = ++geracao.current;
    setCarregando(true);
    setErro(null);
    try {
      const r = await api.call('tenantBuyers', undefined, {
        query: { search: q || undefined, cursor: cursor ?? undefined, limit: 30 },
      });
      if (minha !== geracao.current) return;
      setClientes((antes) => (cursor === null ? r.buyers : [...antes, ...r.buyers]));
      setProximo(r.nextCursor);
    } catch (e) {
      if (minha !== geracao.current) return;
      setErro(e);
    } finally {
      if (minha === geracao.current) setCarregando(false);
    }
  }, []);

  // Busca com pausa: nao consulta a cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setTermo(busca.trim()), 350);
    return () => clearTimeout(t);
  }, [busca]);
  useEffect(() => {
    void carregar(null, termo);
  }, [carregar, termo]);

  return (
    <>
      <PageHeader title="Clientes" description="Quem comprou nos seus sorteios, com o resumo dos pedidos." />
      <div className="field" style={{ maxWidth: '28rem' }}>
        <label className="field__label" htmlFor="busca-clientes">
          Buscar cliente
        </label>
        <div className="row">
          <Search size={16} aria-hidden="true" />
          <input
            id="busca-clientes"
            className="input"
            type="search"
            placeholder="Nome, telefone ou e-mail"
            value={busca}
            maxLength={80}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      {erro ? (
        <ErrorPanel error={erro} onRetry={() => void carregar(null, termo)} />
      ) : carregando && clientes.length === 0 ? (
        <TableSkeleton rows={6} cols={6} />
      ) : clientes.length === 0 ? (
        <EmptyState
          icon={<Search size={26} aria-hidden="true" />}
          title={termo ? 'Nenhum cliente encontrado' : 'Ainda não há clientes'}
          text={termo ? 'Tente outro nome, telefone ou e-mail.' : 'Quando alguém comprar números, aparece aqui.'}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col">Contato</th>
                <th scope="col">Sorteios</th>
                <th scope="col" className="table__num">
                  Pedidos pagos
                </th>
                <th scope="col" className="table__num">
                  Números
                </th>
                <th scope="col" className="table__num">
                  Total pago
                </th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.buyerId}>
                  <td>
                    <span className="table__primary">{c.name}</span>
                    {c.lastOrderAt && <p className="table__secondary">Último pedido em {formatDateTime(c.lastOrderAt)}</p>}
                  </td>
                  <td>
                    {c.phone ?? '—'}
                    {c.email && <p className="table__secondary">{c.email}</p>}
                  </td>
                  <td>
                    {c.draws.map((d, i) => (
                      <span key={d.slug}>
                        {i > 0 && ', '}
                        <Link to="/sorteios" title={d.title}>
                          {d.title}
                        </Link>
                      </span>
                    ))}
                  </td>
                  <td className="table__num">
                    {c.paidOrders}/{c.orders}
                  </td>
                  <td className="table__num">{c.numbers}</td>
                  <td className="table__num">{formatCents(c.totalPaidCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {proximo && !carregando && (
        <button type="button" className="btn btn--ghost" onClick={() => void carregar(proximo, termo)}>
          Carregar mais
        </button>
      )}
    </>
  );
}
