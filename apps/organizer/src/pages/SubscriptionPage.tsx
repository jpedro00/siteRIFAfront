import { useState } from 'react';
import { CreditCard, ExternalLink } from 'lucide-react';
import {
  ApiClientError,
  formatCents,
  formatDate,
  type BillingInvoice,
  type EntitlementsResponse,
  type MySubscriptionResponse,
  type Plan,
} from '@clubedarifa/shared';
import { api } from '../api.ts';
import { Notice, ToneBadge, UsageMeter } from '../components/BillingUi.tsx';
import { ErrorPanel, MetricsSkeleton, PageHeader } from '../components/Ui.tsx';
import { useApiResource } from '../hooks/useApiResource.ts';
import {
  STATES_THAT_CAN_SUBSCRIBE,
  describeBillingState,
  intervalLabel,
} from '../lib/billingCopy.ts';
import { redirectTo } from '../lib/navigate.ts';
import { useSession } from '../state/SessionProvider.tsx';

/**
 * Minha assinatura (Fase 7 · FLUXO A: a assinatura da PLATAFORMA, paga pela comunidade).
 *
 * A tela so MOSTRA o que a API devolveu e leva a pessoa ate a Stripe:
 *  - contratar manda APENAS o `planId`; o preco e o Price sao do servidor;
 *  - gerenciar (cartao, faturas, cancelamento, troca de plano) e o Customer Portal — nada
 *    disso e recriado aqui;
 *  - voltar da Stripe nao ativa nada: o estado vem do webhook, e a tela so o le de novo.
 * Os limites sao exibidos como informacao. Quem barra uma operacao e sempre a API.
 */

const FATURA: Record<BillingInvoice['status'], string> = {
  paid: 'Paga',
  open: 'Em aberto',
  draft: 'Em preparação',
  void: 'Cancelada',
  uncollectible: 'Não cobrada',
};

export function SubscriptionPage() {
  const { can } = useSession();
  const billing = useApiResource<MySubscriptionResponse>((signal) => api.call('tenantBilling', undefined, { signal }), []);
  const entitlements = useApiResource<EntitlementsResponse>((signal) => api.call('tenantEntitlements', undefined, { signal }), []);
  const planos = useApiResource<{ plans: Plan[] }>((signal) => api.call('tenantBillingPlans', undefined, { signal }), []);

  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const podeGerir = can('billing:manage');

  const irParaStripe = async (chave: string, acao: () => Promise<{ url: string }>) => {
    setOcupado(chave);
    setErro(null);
    try {
      const { url } = await acao();
      redirectTo(url);
    } catch (falha) {
      setErro(falha instanceof ApiClientError ? falha.message : 'Não foi possível abrir a página de pagamento. Tente novamente.');
      setOcupado(null);
    }
  };

  const recarregar = () => {
    billing.reload();
    entitlements.reload();
    planos.reload();
  };

  if (billing.status === 'loading' || entitlements.status === 'loading') {
    return (
      <>
        <PageHeader title="Minha assinatura" />
        <MetricsSkeleton count={2} />
      </>
    );
  }

  if (billing.status === 'error' || !billing.data) {
    return (
      <>
        <PageHeader title="Minha assinatura" />
        <ErrorPanel error={billing.error} onRetry={recarregar} title="Não foi possível carregar a assinatura" />
      </>
    );
  }

  const { state, subscription, invoices } = billing.data;
  const limites = entitlements.data;
  const enforcement = limites?.enforcementEnabled ?? false;
  const visao = describeBillingState(state, {
    graceEndsAt: limites?.graceEndsAt ?? null,
    periodEnd: subscription?.currentPeriodEnd ?? null,
    enforcementEnabled: enforcement,
  });
  const podeContratar = STATES_THAT_CAN_SUBSCRIBE.includes(state);
  const temAssinatura = subscription !== null && state !== 'NO_SUBSCRIPTION';

  return (
    <>
      <PageHeader
        title="Minha assinatura"
        description="O plano da sua comunidade na plataforma e os limites que ele oferece."
        badge={<ToneBadge tone={visao.tone}>{visao.label}</ToneBadge>}
        actions={
          temAssinatura && podeGerir ? (
            <button
              type="button"
              className="btn btn--primary"
              disabled={ocupado !== null}
              onClick={() => void irParaStripe('portal', () => api.call('tenantBillingPortal'))}
            >
              {ocupado === 'portal' ? <span className="btn__spinner" aria-hidden="true" /> : <CreditCard size={16} aria-hidden="true" />}
              Gerenciar assinatura
            </button>
          ) : undefined
        }
      />

      <div aria-live="polite">
        {erro && (
          <div className="alert alert--danger" role="alert">
            <div className="alert__body">{erro}</div>
          </div>
        )}
      </div>

      <Notice tone={visao.tone} title={visao.headline}>
        <p>{visao.message}</p>
      </Notice>

      {subscription && temAssinatura && (
        <section className="section" aria-labelledby="plano-atual">
          <div className="section__head">
            <h2 className="section__title" id="plano-atual">
              Plano atual
            </h2>
          </div>
          <div className="card">
            <div className="card__body stack stack--sm">
              <p className="table__primary">{subscription.plan.name}</p>
              {subscription.plan.description && <p className="muted">{subscription.plan.description}</p>}
              <p>
                {formatCents(subscription.plan.priceCents)} por {intervalLabel(subscription.plan.interval)}
              </p>
              <RenewalLine subscription={subscription} />
            </div>
          </div>
        </section>
      )}

      {limites && (
        <section className="section" aria-labelledby="limites">
          <div className="section__head">
            <h2 className="section__title" id="limites">
              Limites e consumo
            </h2>
          </div>
          <div className="card">
            <div className="card__body stack">
              <UsageMeter label="Sorteios ativos" used={limites.activeDraws.used} max={limites.activeDraws.max} />
              <UsageMeter label="Equipe" used={limites.teamMembers.used} max={limites.teamMembers.max} />
              <p className="muted">A equipe não conta o proprietário da comunidade.</p>
              {!enforcement && state !== 'NO_SUBSCRIPTION' && (
                <p className="muted">
                  No momento, os limites são apenas informativos: nenhuma ação é bloqueada por eles.
                </p>
              )}
              {limites.features.length > 0 && (
                <div>
                  <p className="table__primary">Recursos do plano</p>
                  <ul className="plain-list">
                    {limites.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
      {entitlements.status === 'error' && (
        <Notice tone="warning" title="Não foi possível carregar os limites">
          <p>Os dados do plano acima continuam corretos. Tente recarregar a página.</p>
        </Notice>
      )}

      {podeContratar && (
        <section className="section" aria-labelledby="planos">
          <div className="section__head">
            <h2 className="section__title" id="planos">
              Planos disponíveis
            </h2>
          </div>
          {planos.status === 'loading' && <MetricsSkeleton count={2} />}
          {planos.status === 'error' && <ErrorPanel error={planos.error} onRetry={planos.reload} title="Não foi possível carregar os planos" />}
          {planos.status === 'ready' && planos.data && planos.data.plans.length === 0 && (
            <Notice tone="neutral" title="Nenhum plano disponível no momento">
              <p>Assim que um plano for publicado, ele aparece aqui.</p>
            </Notice>
          )}
          {planos.status === 'ready' && planos.data && planos.data.plans.length > 0 && (
            <div className="metrics">
              {planos.data.plans.map((plano) => (
                <article className="card" key={plano.id}>
                  <div className="card__body stack stack--sm">
                    <h3 className="table__primary">{plano.name}</h3>
                    {plano.description && <p className="muted">{plano.description}</p>}
                    <p>
                      <strong>{formatCents(plano.priceCents)}</strong> por {intervalLabel(plano.interval)}
                    </p>
                    <ul className="plain-list">
                      <li>{plano.maxActiveDraws === null ? 'Sorteios ativos sem limite' : `Até ${plano.maxActiveDraws} sorteios ativos`}</li>
                      <li>{plano.maxTeamMembers === null ? 'Equipe sem limite' : `Até ${plano.maxTeamMembers} pessoas na equipe`}</li>
                    </ul>
                    {podeGerir ? (
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={ocupado !== null}
                        aria-label={`Contratar o plano ${plano.name}`}
                        // So o planId: o preco nunca sai do navegador.
                        onClick={() => void irParaStripe(plano.id, () => api.call('tenantBillingCheckout', { planId: plano.id }))}
                      >
                        {ocupado === plano.id ? <span className="btn__spinner" aria-hidden="true" /> : null}
                        Contratar
                      </button>
                    ) : (
                      <p className="muted">Somente o proprietário contrata planos.</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {invoices.length > 0 && (
        <section className="section" aria-labelledby="faturas">
          <div className="section__head">
            <h2 className="section__title" id="faturas">
              Últimas faturas
            </h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Faturas da assinatura</caption>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Situação</th>
                  <th scope="col" className="table__num">
                    Valor
                  </th>
                  <th scope="col">
                    <span className="sr-only">Fatura</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((f) => (
                  <tr key={f.id}>
                    <td>{formatDate(f.paidAt ?? f.createdAt)}</td>
                    <td>{FATURA[f.status]}</td>
                    <td className="table__num">{formatCents(f.status === 'paid' ? f.amountPaidCents : f.amountDueCents)}</td>
                    <td>
                      {f.hostedInvoiceUrl && (
                        <a className="btn btn--ghost btn--sm" href={f.hostedInvoiceUrl} target="_blank" rel="noreferrer noopener">
                          <ExternalLink size={14} aria-hidden="true" />
                          Ver fatura
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function RenewalLine({ subscription }: { subscription: NonNullable<MySubscriptionResponse['subscription']> }) {
  const fim = formatDate(subscription.currentPeriodEnd);
  if (subscription.status === 'canceled') {
    const quando = formatDate(subscription.canceledAt);
    return <p className="muted">{quando ? `Cancelada em ${quando}.` : 'Assinatura cancelada.'}</p>;
  }
  if (subscription.cancelAtPeriodEnd) {
    return (
      <p className="muted">
        <strong>Cancelamento agendado.</strong> {fim ? `O plano continua valendo até ${fim}.` : 'O plano continua valendo até o fim do período.'}
      </p>
    );
  }
  if (!fim) return null;
  return <p className="muted">{subscription.status === 'trialing' ? `Fim do teste: ${fim}.` : `Próxima renovação: ${fim}.`}</p>;
}
