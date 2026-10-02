import { CheckCircle2, CircleSlash, RefreshCw } from 'lucide-react';
import {
  RESERVATION_TTL_MINUTES,
  type PaymentMethodAvailability,
  type PaymentMethodKind,
  type PaymentMethodReason,
} from '@clubedarifa/shared';
import { useApiResource } from '../hooks/useApiResource.ts';
import { api } from '../api.ts';

/**
 * Meios de pagamento da conta conectada (M05, por capacidades).
 *
 * Mostra o que o PROVEDOR diz que a conta oferece e o que a PLATAFORMA liga. Nada aqui e
 * botao de ligar: habilitar um meio depende de fluxo proprio (tokenizacao no navegador,
 * confirmacao) e, no boleto, de uma politica de prazo que ainda nao existe.
 */
const NOME: Record<PaymentMethodKind, string> = {
  PIX: 'PIX',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  ACCOUNT_MONEY: 'Saldo na conta Mercado Pago',
  BOLETO: 'Boleto',
  OTHER: 'Outros meios do provedor',
};

function explicacao(m: PaymentMethodAvailability): string {
  const porMotivo: Record<PaymentMethodReason, string> = {
    ENABLED: 'Ativo: os participantes pagam por este meio.',
    NOT_REPORTED_BY_PROVIDER: 'A conta conectada não oferece este meio no Mercado Pago.',
    NOT_SUPPORTED_YET: m.providerReported
      ? 'A sua conta oferece, mas a plataforma ainda não habilitou este meio.'
      : 'Ainda não habilitado pela plataforma.',
    RESERVATION_WINDOW_UNDEFINED: `Desligado: o boleto leva dias para compensar e a reserva dos números dura ${RESERVATION_TTL_MINUTES} minutos. Será liberado quando houver uma regra de prazo definida.`,
  };
  return porMotivo[m.reason];
}

export function PaymentMethodsPanel() {
  const r = useApiResource((signal) => api.call('tenantPaymentMethods', undefined, { signal }), []);

  return (
    <section className="section" aria-labelledby="meios-titulo">
      <div className="section__head">
        <h2 className="section__title" id="meios-titulo">
          Meios de pagamento
        </h2>
        <button type="button" className="btn btn--ghost btn--sm" onClick={r.reload} disabled={r.status === 'loading'}>
          <RefreshCw size={14} aria-hidden="true" />
          Atualizar
        </button>
      </div>

      {r.status === 'loading' && <p className="muted" role="status">Consultando o Mercado Pago…</p>}
      {r.status === 'error' && (
        <p className="alert alert--danger" role="alert">
          <span className="alert__body">Não foi possível carregar os meios de pagamento.</span>
        </p>
      )}

      {r.status === 'ready' && r.data?.status === 'UNAVAILABLE' && (
        <p className="alert alert--warning" role="status">
          <span className="alert__body">O Mercado Pago não respondeu agora. Tente atualizar em instantes.</span>
        </p>
      )}

      {r.status === 'ready' && r.data?.status === 'OK' && (
        <ul className="method-list">
          {r.data.methods.map((m) => (
            <li key={m.kind} className={`method${m.enabled ? ' is-enabled' : ''}`}>
              <span className="method__icon" aria-hidden="true">
                {m.enabled ? <CheckCircle2 size={18} /> : <CircleSlash size={18} />}
              </span>
              <div className="method__text">
                <p className="method__name">
                  {NOME[m.kind]}{' '}
                  <span className={`badge ${m.enabled ? 'badge--success' : 'badge--neutral'}`}>
                    {m.enabled ? 'Ativo' : 'Desligado'}
                  </span>
                </p>
                <p className="muted">{explicacao(m)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="field__hint">
        Dados de cartão nunca passam pelo nosso servidor: quando o cartão for habilitado, a digitação será feita
        direto no ambiente seguro do Mercado Pago. Todo pagamento só vale depois de confirmado na consulta ao
        provedor.
      </p>
    </section>
  );
}
