import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, formatDate, type BillingState, type EntitlementsResponse, type MySubscriptionResponse, type Plan } from '@clubedarifa/shared';

const h = vi.hoisted(() => ({
  call: vi.fn(),
  redirectTo: vi.fn(),
  permissions: new Set<string>(),
}));

vi.mock('../src/api.ts', () => ({ api: { call: h.call } }));
vi.mock('../src/lib/navigate.ts', () => ({ redirectTo: h.redirectTo }));
vi.mock('../src/state/SessionProvider.tsx', () => ({
  useSession: () => ({ can: (p: string) => h.permissions.has(p), tenant: { name: 'Clube', roles: ['OWNER'] } }),
}));

import { SubscriptionPage } from '../src/pages/SubscriptionPage.tsx';
import { TeamManagement } from '../src/components/TeamManagement.tsx';

/**
 * "Minha assinatura": os estados de cobranca, os limites e o caminho ate a Stripe.
 * A API e simulada; o que se verifica e o que a PESSOA ve e o que a tela ENVIA.
 */

const plano = (extra: Partial<Plan> = {}): Plan => ({
  id: '11111111-1111-4111-8111-111111111111',
  code: 'basico',
  name: 'Plano Básico',
  description: 'Para começar',
  interval: 'month',
  priceCents: 4990,
  currency: 'brl',
  maxActiveDraws: 5,
  maxTeamMembers: 3,
  features: [],
  status: 'AVAILABLE',
  ...extra,
});

function assinatura(state: BillingState, extra: Partial<NonNullable<MySubscriptionResponse['subscription']>> = {}): MySubscriptionResponse {
  const semAssinatura = state === 'NO_SUBSCRIPTION';
  return {
    state,
    subscription: semAssinatura
      ? null
      : {
          id: '22222222-2222-4222-8222-222222222222',
          plan: plano(),
          status: state === 'ACTIVE' ? 'active' : 'past_due',
          currentPeriodStart: '2026-09-01T12:00:00.000Z',
          currentPeriodEnd: '2026-10-01T12:00:00.000Z',
          cancelAtPeriodEnd: false,
          canceledAt: null,
          trialEnd: null,
          pastDueSince: null,
          ...extra,
        },
    invoices: [],
    nextCursor: null,
  };
}

const limites = (extra: Partial<EntitlementsResponse> = {}): EntitlementsResponse => ({
  state: 'ACTIVE',
  enforcementEnabled: true,
  planCode: 'basico',
  features: [],
  activeDraws: { used: 4, max: 5 },
  teamMembers: { used: 2, max: 3 },
  graceEndsAt: null,
  canSubmitDraws: true,
  reason: 'OK',
  ...extra,
});

function responder(map: Record<string, unknown>) {
  h.call.mockImplementation(async (name: string) => {
    if (!(name in map)) throw new Error(`chamada inesperada: ${name}`);
    const valor = map[name];
    if (valor instanceof Error) throw valor;
    return valor;
  });
}

function abrir() {
  return render(
    <MemoryRouter>
      <SubscriptionPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.call.mockReset();
  h.redirectTo.mockReset();
  h.permissions = new Set(['billing:read', 'billing:manage']);
});

describe('Minha assinatura · estados', () => {
  it('SEM assinatura: explica, lista os planos e oferece contratar (sem botao de gerenciar)', async () => {
    responder({ tenantBilling: assinatura('NO_SUBSCRIPTION'), tenantEntitlements: limites({ state: 'NO_SUBSCRIPTION', planCode: null }), tenantBillingPlans: { plans: [plano()] } });
    abrir();
    expect(await screen.findByText('Sua comunidade ainda não tem um plano')).toBeInTheDocument();
    expect(screen.getByText('Plano Básico')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Contratar o plano Plano Básico' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Gerenciar assinatura/ })).toBeNull();
  });

  it('ACTIVE: mostra plano, valor, periodicidade e proxima renovacao; oferece gerenciar; nao lista planos', async () => {
    responder({ tenantBilling: assinatura('ACTIVE'), tenantEntitlements: limites(), tenantBillingPlans: { plans: [plano()] } });
    abrir();
    expect(await screen.findByText('Sua assinatura está em dia')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*49,90 por mês/)).toBeInTheDocument();
    expect(screen.getByText(`Próxima renovação: ${formatDate('2026-10-01T12:00:00.000Z')}.`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gerenciar assinatura/ })).toBeEnabled();
    expect(screen.queryByText('Planos disponíveis')).toBeNull();
  });

  it('cancelamento agendado e dito com clareza', async () => {
    responder({ tenantBilling: assinatura('ACTIVE', { cancelAtPeriodEnd: true }), tenantEntitlements: limites(), tenantBillingPlans: { plans: [] } });
    abrir();
    expect(await screen.findByText(/Cancelamento agendado/)).toBeInTheDocument();
    expect(screen.getByText(/continua valendo até/)).toBeInTheDocument();
  });

  it('PAST_DUE_GRACE: fala de tolerancia e da data final, sem termo tecnico da Stripe', async () => {
    const fim = '2026-10-04T12:00:00.000Z';
    responder({ tenantBilling: assinatura('PAST_DUE_GRACE', { pastDueSince: '2026-10-01T12:00:00.000Z' }), tenantEntitlements: limites({ state: 'PAST_DUE_GRACE', graceEndsAt: fim }), tenantBillingPlans: { plans: [] } });
    const { container } = abrir();
    expect(await screen.findByText('O último pagamento não foi concluído')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`período de tolerância até ${formatDate(fim)}`))).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/past_due|incomplete|unpaid|stripe/i);
    // O estado aparece em texto no selo, nao so na cor.
    expect(screen.getAllByText('Pagamento em atraso').length).toBeGreaterThan(0);
  });

  it('PAST_DUE_BLOCKED: explica o bloqueio de novos envios e o que continua funcionando', async () => {
    responder({ tenantBilling: assinatura('PAST_DUE_BLOCKED'), tenantEntitlements: limites({ state: 'PAST_DUE_BLOCKED', canSubmitDraws: false, reason: 'SUBSCRIPTION_PAST_DUE_BLOCKED' }), tenantBillingPlans: { plans: [] } });
    abrir();
    expect(await screen.findByText('A tolerância terminou e o pagamento segue pendente')).toBeInTheDocument();
    expect(screen.getByText(/não é possível enviar novos sorteios para revisão/)).toBeInTheDocument();
    expect(screen.getByText(/pagamentos dos participantes não são afetados/)).toBeInTheDocument();
  });

  it('os demais estados tem texto proprio (nenhum cai no vazio)', async () => {
    for (const [estado, trecho] of [
      ['PENDING', 'aguardando a confirmação do pagamento'],
      ['TRIALING', 'período de teste'],
      ['UNPAID', 'sem pagamento'],
      ['PAUSED', 'pausada'],
      ['CANCELED', 'foi cancelada'],
    ] as const) {
      responder({ tenantBilling: assinatura(estado), tenantEntitlements: limites({ state: estado }), tenantBillingPlans: { plans: [plano()] } });
      const { unmount } = abrir();
      await waitFor(() => expect(document.body.textContent?.toLowerCase()).toContain(trecho));
      unmount();
    }
  });
});

describe('Minha assinatura · limites', () => {
  it('limite parcialmente usado: "4 de 5" e "2 de 3", com barra acessivel', async () => {
    responder({ tenantBilling: assinatura('ACTIVE'), tenantEntitlements: limites(), tenantBillingPlans: { plans: [] } });
    abrir();
    expect(await screen.findByText('4 de 5')).toBeInTheDocument();
    expect(screen.getByText('2 de 3')).toBeInTheDocument();
    const barra = screen.getByRole('progressbar', { name: 'Sorteios ativos' });
    expect(barra).toHaveAttribute('aria-valuenow', '4');
    expect(barra).toHaveAttribute('aria-valuemax', '5');
  });

  it('plano ILIMITADO: nao inventa numero nem barra', async () => {
    responder({
      tenantBilling: assinatura('ACTIVE'),
      tenantEntitlements: limites({ activeDraws: { used: 7, max: null }, teamMembers: { used: 1, max: null } }),
      tenantBillingPlans: { plans: [] },
    });
    abrir();
    expect(await screen.findByText('7 em uso · sem limite')).toBeInTheDocument();
    expect(screen.getByText('1 em uso · sem limite')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('limite atingido e dito em texto', async () => {
    responder({ tenantBilling: assinatura('ACTIVE'), tenantEntitlements: limites({ activeDraws: { used: 5, max: 5 } }), tenantBillingPlans: { plans: [] } });
    abrir();
    expect(await screen.findByText('5 de 5 · limite atingido')).toBeInTheDocument();
  });

  it('com o enforcement desligado, a tela nao finge que existe bloqueio', async () => {
    responder({ tenantBilling: assinatura('ACTIVE'), tenantEntitlements: limites({ enforcementEnabled: false }), tenantBillingPlans: { plans: [] } });
    abrir();
    expect(await screen.findByText(/os limites são apenas informativos/)).toBeInTheDocument();
  });

  it('nao inventa recursos: sem features no plano, nao ha secao de recursos', async () => {
    responder({ tenantBilling: assinatura('ACTIVE'), tenantEntitlements: limites({ features: [] }), tenantBillingPlans: { plans: [] } });
    abrir();
    await screen.findByText('Limites e consumo');
    expect(screen.queryByText('Recursos do plano')).toBeNull();
  });
});

describe('Minha assinatura · Stripe', () => {
  it('Checkout: envia SO o planId e segue para a URL devolvida pelo servidor', async () => {
    responder({
      tenantBilling: assinatura('NO_SUBSCRIPTION'),
      tenantEntitlements: limites({ state: 'NO_SUBSCRIPTION' }),
      tenantBillingPlans: { plans: [plano()] },
      tenantBillingCheckout: { url: 'https://checkout.stripe.test/c/pay/cs_123' },
    });
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Contratar o plano Plano Básico' }));
    await waitFor(() => expect(h.redirectTo).toHaveBeenCalledWith('https://checkout.stripe.test/c/pay/cs_123'));
    expect(h.call).toHaveBeenCalledWith('tenantBillingCheckout', { planId: '11111111-1111-4111-8111-111111111111' });
    // nenhuma chamada carregou preco
    const corpo = h.call.mock.calls.find((c) => c[0] === 'tenantBillingCheckout')![1];
    expect(Object.keys(corpo)).toEqual(['planId']);
  });

  it('Customer Portal: abre a URL devolvida (nao recria cartao, fatura nem cancelamento)', async () => {
    responder({
      tenantBilling: assinatura('ACTIVE'),
      tenantEntitlements: limites(),
      tenantBillingPlans: { plans: [] },
      tenantBillingPortal: { url: 'https://billing.stripe.test/p/session_1' },
    });
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: /Gerenciar assinatura/ }));
    await waitFor(() => expect(h.redirectTo).toHaveBeenCalledWith('https://billing.stripe.test/p/session_1'));
    expect(h.call).toHaveBeenCalledWith('tenantBillingPortal');
  });

  it('BILLING_UNAVAILABLE: mostra o aviso, nao redireciona e libera o botao de novo', async () => {
    responder({
      tenantBilling: assinatura('NO_SUBSCRIPTION'),
      tenantEntitlements: limites({ state: 'NO_SUBSCRIPTION' }),
      tenantBillingPlans: { plans: [plano()] },
      tenantBillingCheckout: new ApiClientError({ code: 'BILLING_UNAVAILABLE', message: 'A contratação de planos não está disponível agora. Tente novamente mais tarde.', status: 503 }),
    });
    abrir();
    const botao = await screen.findByRole('button', { name: 'Contratar o plano Plano Básico' });
    fireEvent.click(botao);
    expect(await screen.findByText(/não está disponível agora/)).toBeInTheDocument();
    expect(h.redirectTo).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Contratar o plano Plano Básico' })).toBeEnabled());
  });

  it('quem so le (financeiro) ve a situacao, mas nao contrata nem gerencia', async () => {
    h.permissions = new Set(['billing:read']);
    responder({ tenantBilling: assinatura('NO_SUBSCRIPTION'), tenantEntitlements: limites({ state: 'NO_SUBSCRIPTION' }), tenantBillingPlans: { plans: [plano()] } });
    abrir();
    expect(await screen.findByText('Somente o proprietário contrata planos.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Contratar/ })).toBeNull();
  });

  it('erro ao carregar a assinatura: mostra o erro com opcao de tentar de novo', async () => {
    responder({
      tenantBilling: new ApiClientError({ code: 'INTERNAL', message: 'Erro interno. Tente novamente em instantes.', status: 500 }),
      tenantEntitlements: limites(),
      tenantBillingPlans: { plans: [] },
    });
    abrir();
    expect(await screen.findByText('Não foi possível carregar a assinatura')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeInTheDocument();
  });
});

describe('Limite do plano ao convidar para a equipe', () => {
  it('PLAN_LIMIT_REACHED: explica e oferece "Minha assinatura"; o convite nao foi travado antes pela tela', async () => {
    h.call.mockImplementation(async (name: string) => {
      if (name === 'tenantTeam') return { members: [], invitations: [] };
      if (name === 'tenantEntitlements') return limites({ teamMembers: { used: 3, max: 3 } });
      if (name === 'inviteTeamMember') {
        throw new ApiClientError({ code: 'PLAN_LIMIT_REACHED', message: 'Sua comunidade atingiu o limite de membros da equipe do plano.', status: 409, details: { reason: 'MEMBER_LIMIT_REACHED' } });
      }
      throw new Error(`inesperada: ${name}`);
    });
    render(
      <MemoryRouter>
        <TeamManagement />
      </MemoryRouter>,
    );
    // Mesmo com "3 de 3" a tela deixa o envio para a API decidir.
    expect(await screen.findByText('3 de 3 · limite atingido')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('E-mail da pessoa'), { target: { value: 'nova@exemplo.com' } });
    const botaoConvidar = screen.getByRole('button', { name: 'Convidar' });
    expect(botaoConvidar).toBeEnabled();
    fireEvent.click(botaoConvidar);

    const alerta = await screen.findByRole('alert');
    expect(within(alerta).getByText(/atingiu o limite de membros/)).toBeInTheDocument();
    expect(within(alerta).getByRole('link', { name: 'Ver minha assinatura' })).toHaveAttribute('href', '/assinatura');
  });

  it('SUBSCRIPTION_REQUIRED ao convidar: explica a situacao e oferece a area de assinatura', async () => {
    h.call.mockImplementation(async (name: string) => {
      if (name === 'tenantTeam') return { members: [], invitations: [] };
      if (name === 'tenantEntitlements') return limites({ enforcementEnabled: true });
      if (name === 'inviteTeamMember') {
        throw new ApiClientError({ code: 'SUBSCRIPTION_REQUIRED', message: 'A comunidade não tem um plano vigente.', status: 403, details: { reason: 'NO_PLAN' } });
      }
      throw new Error(`inesperada: ${name}`);
    });
    render(
      <MemoryRouter>
        <TeamManagement />
      </MemoryRouter>,
    );
    await screen.findByText(/Equipe/);
    fireEvent.change(screen.getByLabelText('E-mail da pessoa'), { target: { value: 'nova@exemplo.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Convidar' }));
    const alerta = await screen.findByRole('alert');
    expect(within(alerta).getByText('A comunidade não tem um plano vigente.')).toBeInTheDocument();
    expect(within(alerta).getByRole('link', { name: 'Ver minha assinatura' })).toBeInTheDocument();
  });
});
