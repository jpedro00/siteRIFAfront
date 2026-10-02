import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import {
  formatCents,
  formatDateTime,
  type PlatformReconciliationResponse,
  type ReconciliationKind,
} from '@clubedarifa/shared';
import { api } from '../api.ts';
import { ToneBadge } from '../components/BillingUi.tsx';
import { ErrorState, Loading } from '../components/States.tsx';
import type { Tone } from '../lib/billingAdmin.ts';

/**
 * Financeiro · divergencias da conciliacao (DOC-01 §17 · Cobrancas).
 *
 * So leitura: a conciliacao do worker compara o que o PSP diz com o que a plataforma tem e
 * registra o que nao fecha. Resolver cada caso e uma acao financeira (devolucao, ajuste) que
 * ainda nao existe no console; por isso esta tela mostra, nao age. Nenhum identificador
 * completo de pagamento aparece — so uma referencia curta do pedido.
 */
const TIPOS: Record<ReconciliationKind, { rotulo: string; tone: Tone; explicacao: string }> = {
  APPROVED_ORDER_NOT_PAID: {
    rotulo: 'Aprovado no provedor, pedido não pago',
    tone: 'danger',
    explicacao: 'O provedor diz que o pagamento foi aprovado, mas o pedido não aparece como pago.',
  },
  ORDER_PAID_PAYMENT_NOT_APPROVED: {
    rotulo: 'Pedido pago sem aprovação',
    tone: 'danger',
    explicacao: 'O pedido consta como pago, mas o pagamento não está aprovado.',
  },
  PSP_APPROVED_LOCAL_PENDING: {
    rotulo: 'Aprovado no provedor, pendente aqui',
    tone: 'warning',
    explicacao: 'O provedor aprovou e o pagamento local ainda está pendente. A conciliação tenta resolver sozinha.',
  },
  MANUAL_REFUND_OPEN: {
    rotulo: 'Devolução manual em aberto',
    tone: 'warning',
    explicacao: 'Pagamento aprovado depois de o número ter outro dono: o dinheiro precisa ser devolvido à pessoa.',
  },
  PAYMENT_AUTHORIZATION_UNAVAILABLE: {
    rotulo: 'Conta de recebimento indisponível',
    tone: 'info',
    explicacao: 'A autorização da conta do organizador caiu com um pagamento pendente. Não é possível consultá-lo no provedor.',
  },
};

export function FinancePage() {
  const [data, setData] = useState<PlatformReconciliationResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .call('platformReconciliation')
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  if (loading && !data) return <Loading label="Carregando o financeiro…" />;
  if (error != null) return <ErrorState error={error} onRetry={load} />;
  if (!data) return null;

  return (
    <>
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Financeiro</h1>
          <p className="page-header__description">
            Divergências abertas da conciliação entre o provedor de pagamento e os pedidos. Gerado em{' '}
            {formatDateTime(data.generatedAt)}.
          </p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn--secondary" onClick={load} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" />
            Atualizar
          </button>
        </div>
      </header>

      {data.openCount === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon">
            <CheckCircle2 size={26} aria-hidden="true" />
          </span>
          <h2 className="empty-state__title">Nenhuma divergência aberta</h2>
          <p className="empty-state__text">A conciliação não encontrou diferenças pendentes.</p>
        </div>
      ) : (
        <>
          <ul className="chip-row" aria-label="Divergências por tipo">
            {data.byKind.map((k) => (
              <li key={k.kind}>
                <ToneBadge tone={TIPOS[k.kind].tone}>
                  {TIPOS[k.kind].rotulo}: {k.count}
                </ToneBadge>
              </li>
            ))}
          </ul>

          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Divergências abertas, das mais recentes às mais antigas</caption>
              <thead>
                <tr>
                  <th scope="col">Tipo</th>
                  <th scope="col">Comunidade</th>
                  <th scope="col">Pedido</th>
                  <th scope="col" className="table__num">
                    Valor
                  </th>
                  <th scope="col">Detectada em</th>
                </tr>
              </thead>
              <tbody>
                {data.issues.map((i, n) => (
                  <tr key={`${i.reference}-${i.kind}-${n}`}>
                    <td>
                      <ToneBadge tone={TIPOS[i.kind].tone}>{TIPOS[i.kind].rotulo}</ToneBadge>
                      <p className="muted table__hint">{TIPOS[i.kind].explicacao}</p>
                    </td>
                    <td>
                      {i.tenantName}
                      <br />
                      <code className="slug">{i.tenantSlug}</code>
                    </td>
                    <td>
                      <code>{i.reference}</code>
                    </td>
                    <td className="table__num">{formatCents(i.amountCents)}</td>
                    <td>{formatDateTime(i.detectedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.openCount > data.issues.length && (
            <p className="muted">Mostrando as {data.issues.length} mais recentes de {data.openCount}.</p>
          )}
        </>
      )}
    </>
  );
}
