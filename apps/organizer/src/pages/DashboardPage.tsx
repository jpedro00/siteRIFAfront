import { Link } from 'react-router-dom';
import {
  BadgeDollarSign,
  CircleDot,
  FileText,
  Plus,
  ShieldCheck,
  Ticket,
  Timer,
  Users,
} from 'lucide-react';
import { formatCentsCompact, formatInteger } from '@campaigns/shared';
import {
  EmptyState,
  ErrorPanel,
  MetricCard,
  MetricsSkeleton,
  PageHeader,
  StatusBadge,
  TableSkeleton,
} from '../components/Ui.tsx';
import { useApiResource } from '../hooks/useApiResource.ts';
import { useSession } from '../state/SessionProvider.tsx';
import { api } from '../api.ts';

/**
 * Visao geral.
 *
 * TODA metrica desta tela e derivada dos sorteios que a API devolveu. Nao ha
 * "visitantes", "conversao" nem "ticket medio": o backend nao mede nada disso
 * nesta fatia, e um numero bonito sem origem e a forma mais rapida de um
 * painel de gestao perder a credibilidade.
 *
 * RN18 — arrecadacao soma apenas o que foi PAGO. Reserva nao e receita: ela
 * pode vencer nos proximos trinta minutos.
 */
export function DashboardPage() {
  const { tenant, can } = useSession();

  const sorteios = useApiResource(
    (signal) => api.call('organizerDraws', undefined, { signal }),
    [],
  );

  const lista = sorteios.data?.draws ?? [];
  const ativos = lista.filter((d) => d.status === 'ATIVA');
  const rascunhos = lista.filter((d) => d.status === 'RASCUNHO');
  const pagos = lista.reduce((soma, d) => soma + d.paidCount, 0);
  const reservados = lista.reduce((soma, d) => soma + d.reservedCount + d.pendingCount, 0);
  const arrecadado = lista.reduce((soma, d) => soma + d.revenueCents, 0);

  return (
    <>
      <PageHeader
        title={tenant?.name ?? 'Visão geral'}
        description="Resumo dos sorteios desta comunidade."
        actions={
          can('draw:write') ? (
            <Link className="btn btn--primary" to="/sorteios/novo">
              <Plus size={16} aria-hidden="true" />
              Novo sorteio
            </Link>
          ) : undefined
        }
      />

      {sorteios.status === 'loading' && <MetricsSkeleton />}

      {sorteios.status === 'error' && (
        <ErrorPanel error={sorteios.error} onRetry={sorteios.reload} />
      )}

      {sorteios.status === 'ready' && (
        <>
          <div className="metrics">
            <MetricCard
              label="Sorteios ativos"
              value={formatInteger(ativos.length)}
              hint={ativos.length === 0 ? 'Nenhum sorteio com vendas abertas' : 'Com vendas abertas'}
              icon={<CircleDot size={17} aria-hidden="true" />}
              tone="success"
            />
            <MetricCard
              label="Rascunhos"
              value={formatInteger(rascunhos.length)}
              hint="Ainda não publicados"
              icon={<FileText size={17} aria-hidden="true" />}
              tone="neutral"
            />
            <MetricCard
              label="Números pagos"
              value={formatInteger(pagos)}
              hint="Somente pagamentos confirmados"
              icon={<Ticket size={17} aria-hidden="true" />}
            />
            <MetricCard
              label="Números reservados"
              value={formatInteger(reservados)}
              hint="Reservas no prazo e pedidos aguardando pagamento"
              icon={<Timer size={17} aria-hidden="true" />}
              tone="warning"
            />
            {/*
              Arrecadacao so entra quando existe. Um "R$ 0,00" em destaque numa
              comunidade que ainda nao vendeu nada nao informa — desanima.
            */}
            {arrecadado > 0 && (
              <MetricCard
                label="Arrecadação"
                value={formatCentsCompact(arrecadado)}
                hint="Total dos pedidos pagos"
                icon={<BadgeDollarSign size={17} aria-hidden="true" />}
                tone="success"
              />
            )}
          </div>

          <section className="section">
            <div className="section__head">
              <h2 className="section__title">Sorteios recentes</h2>
              {lista.length > 0 && (
                <Link className="btn btn--ghost btn--sm" to="/sorteios">
                  Ver todos
                </Link>
              )}
            </div>

            {lista.length === 0 ? (
              <EmptyState
                icon={<Ticket size={26} aria-hidden="true" />}
                title="Nenhum sorteio ainda"
                text="Crie o primeiro sorteio desta comunidade para começar a vender números."
                action={
                  can('draw:write') ? (
                    <Link className="btn btn--primary" to="/sorteios/novo">
                      <Plus size={16} aria-hidden="true" />
                      Criar sorteio
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
                        Pagos
                      </th>
                      <th scope="col" className="table__num">
                        Arrecadado
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.slice(0, 5).map((draw) => (
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
                        <td className="table__num">
                          {formatInteger(draw.paidCount)} / {formatInteger(draw.totalNumbers)}
                        </td>
                        <td className="table__num">{formatCentsCompact(draw.revenueCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {sorteios.status === 'loading' && (
        <section className="section">
          <TableSkeleton rows={4} cols={4} />
        </section>
      )}

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Ações rápidas</h2>
        </div>
        <div className="quick-actions">
          {can('draw:write') && (
            <Link className="quick-action" to="/sorteios/novo">
              <span className="quick-action__icon">
                <Plus size={18} aria-hidden="true" />
              </span>
              <span>
                <span className="quick-action__title">Criar sorteio</span>
                <span className="quick-action__text">Defina prêmio, preço e tamanho da grade</span>
              </span>
            </Link>
          )}
          <Link className="quick-action" to="/equipe">
            <span className="quick-action__icon">
              <Users size={18} aria-hidden="true" />
            </span>
            <span>
              <span className="quick-action__title">Equipe e permissões</span>
              <span className="quick-action__text">Quem tem acesso a esta comunidade</span>
            </span>
          </Link>
          {can('team:manage') && (
            <Link className="quick-action" to="/auditoria">
              <span className="quick-action__icon">
                <ShieldCheck size={18} aria-hidden="true" />
              </span>
              <span>
                <span className="quick-action__title">Trilha de auditoria</span>
                <span className="quick-action__text">Histórico de ações na comunidade</span>
              </span>
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
