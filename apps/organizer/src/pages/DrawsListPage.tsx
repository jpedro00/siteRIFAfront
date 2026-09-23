import { Link } from 'react-router-dom';
import { Plus, Ticket } from 'lucide-react';
import { formatCents, formatCentsCompact, formatDate, formatInteger, percentOf } from '@campaigns/shared';
import {
  EmptyState,
  ErrorPanel,
  PageHeader,
  StatusBadge,
  TableSkeleton,
} from '../components/Ui.tsx';
import { useApiResource } from '../hooks/useApiResource.ts';
import { useSession } from '../state/SessionProvider.tsx';
import { api } from '../api.ts';

/**
 * Lista de sorteios: `/sorteios`.
 *
 * Tabela em vez de cartoes. A escolha nao e estetica: quem opera compara —
 * quanto cada sorteio vendeu, qual esta parado, qual encerra primeiro — e
 * comparacao pede colunas alinhadas. Cartoes sao melhores para escolher UM,
 * que e o trabalho da vitrine, nao deste painel.
 */
export function DrawsListPage() {
  const { can } = useSession();

  const sorteios = useApiResource(
    (signal) => api.call('organizerDraws', undefined, { signal }),
    [],
  );

  const lista = sorteios.data?.draws ?? [];

  return (
    <>
      <PageHeader
        title="Sorteios"
        description="Todos os sorteios desta comunidade, publicados ou em rascunho."
        actions={
          can('draw:write') ? (
            <Link className="btn btn--primary" to="/sorteios/novo">
              <Plus size={16} aria-hidden="true" />
              Novo sorteio
            </Link>
          ) : undefined
        }
      />

      {sorteios.status === 'loading' && <TableSkeleton rows={6} cols={6} />}

      {sorteios.status === 'error' && (
        <ErrorPanel error={sorteios.error} onRetry={sorteios.reload} />
      )}

      {sorteios.status === 'ready' &&
        (lista.length === 0 ? (
          <EmptyState
            icon={<Ticket size={26} aria-hidden="true" />}
            title="Nenhum sorteio criado"
            text="Quando você criar um sorteio, ele aparece aqui com o andamento das vendas."
            action={
              can('draw:write') ? (
                <Link className="btn btn--primary" to="/sorteios/novo">
                  <Plus size={16} aria-hidden="true" />
                  Criar o primeiro sorteio
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Sorteio</th>
                  <th scope="col">Situação</th>
                  <th scope="col" className="table__num">
                    Valor
                  </th>
                  <th scope="col" className="table__num">
                    Vendidos
                  </th>
                  <th scope="col" className="table__num">
                    Arrecadado
                  </th>
                  <th scope="col">Data do sorteio</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((draw) => {
                  const percentual = percentOf(draw.paidCount, draw.totalNumbers);
                  const data = formatDate(draw.drawDate);
                  return (
                    <tr key={draw.id}>
                      <td>
                        <Link className="table__primary" to={`/sorteios/${draw.id}`}>
                          {draw.title}
                        </Link>
                        <p className="table__secondary">{draw.prizeName}</p>
                      </td>
                      <td>
                        <StatusBadge status={draw.status} />
                      </td>
                      <td className="table__num">{formatCents(draw.unitPriceCents)}</td>
                      <td className="table__num">
                        {formatInteger(draw.paidCount)} / {formatInteger(draw.totalNumbers)}
                        <p className="table__secondary">{percentual}%</p>
                      </td>
                      <td className="table__num">{formatCentsCompact(draw.revenueCents)}</td>
                      <td>{data ?? <span className="subtle">Não definida</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
    </>
  );
}
