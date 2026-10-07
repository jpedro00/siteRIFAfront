import { useState } from 'react';
import { CheckCircle2, CircleSlash, Pause, Play, RefreshCw } from 'lucide-react';
import {
  ApiClientError,
  RESERVATION_TTL_MINUTES,
  creatorTogglableMethods,
  type PaymentMethodAvailability,
  type PaymentMethodKind,
  type PaymentMethodReason,
} from '@clubedarifa/shared';
import { useApiResource } from '../hooks/useApiResource.ts';
import { api } from '../api.ts';
import { useSession } from '../state/SessionProvider.tsx';

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
    DISABLED_BY_CREATOR: 'Pausado por você: ninguém consegue reservar números enquanto o PIX estiver pausado. Retome quando quiser vender de novo.',
    RESERVATION_WINDOW_UNDEFINED: `Desligado: o boleto leva dias para compensar e a reserva dos números dura ${RESERVATION_TTL_MINUTES} minutos. Será liberado quando houver uma regra de prazo definida.`,
  };
  return porMotivo[m.reason];
}

export function PaymentMethodsPanel() {
  const { can } = useSession();
  const r = useApiResource((signal) => api.call('tenantPaymentMethods', undefined, { signal }), []);
  const [alterando, setAlterando] = useState<PaymentMethodKind | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const podeGerir = can('payment_account:manage');
  const alternaveis = creatorTogglableMethods();

  async function alternar(kind: PaymentMethodKind, enabled: boolean) {
    setAlterando(kind);
    setFalha(null);
    try {
      await api.call('setTenantPaymentMethod', { method: kind, enabled });
      r.reload();
    } catch (e) {
      setFalha(e instanceof ApiClientError ? e.message : 'Não foi possível alterar agora. Tente novamente.');
    } finally {
      setAlterando(null);
    }
  }

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
                {podeGerir && alternaveis.includes(m.kind) && m.providerReported && (
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    disabled={alterando !== null}
                    onClick={() => void alternar(m.kind, !m.enabled)}
                  >
                    {m.enabled ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
                    {m.enabled ? `Pausar ${NOME[m.kind]}` : `Retomar ${NOME[m.kind]}`}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {falha && (
        <p className="alert alert--danger" role="alert">
          <span className="alert__body">{falha}</span>
        </p>
      )}
      <p className="field__hint">
        Dados de cartão nunca passam pelo nosso servidor: quando o cartão for habilitado, a digitação será feita
        direto no ambiente seguro do Mercado Pago. Todo pagamento só vale depois de confirmado na consulta ao
        provedor.
      </p>
    </section>
  );
}
