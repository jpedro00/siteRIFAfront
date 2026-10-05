import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, type PlatformHealthResponse, type PlatformSubscriptionItem } from '@clubedarifa/shared';

const h = vi.hoisted(() => ({ call: vi.fn() }));

vi.mock('../src/api.ts', () => ({ api: { call: h.call } }));
vi.mock('../src/state/SessionProvider.tsx', () => ({
  useSession: () => ({ can: () => true }),
}));

import { HealthPage } from '../src/pages/HealthPage.tsx';
import { SubscriptionsPage } from '../src/pages/SubscriptionsPage.tsx';

/** Assinaturas (somente consulta) e os novos indicadores financeiros da Saude. */

const item = (n: number, extra: Partial<PlatformSubscriptionItem> = {}): PlatformSubscriptionItem => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  tenantId: `11111111-0000-4000-8000-${String(n).padStart(12, '0')}`,
  tenantSlug: `comunidade-${n}`,
  tenantName: `Comunidade ${n}`,
  planCode: 'basico-mensal',
  planName: 'Básico',
  status: 'active',
  state: 'ACTIVE',
  currentPeriodEnd: '2026-10-20T12:00:00.000Z',
  pastDueSince: null,
  graceEndsAt: null,
  cancelAtPeriodEnd: false,
  ...extra,
});

beforeEach(() => {
  h.call.mockReset();
});

describe('Console · Assinaturas', () => {
  it('lista as assinaturas com estado de negocio, estado bruto, atraso, fim da tolerancia e cancelamento agendado', async () => {
    h.call.mockResolvedValue({
      subscriptions: [
        item(1),
        item(2, { status: 'past_due', state: 'PAST_DUE_GRACE', pastDueSince: '2026-09-28T12:00:00.000Z', graceEndsAt: '2026-10-01T12:00:00.000Z' }),
        item(3, { cancelAtPeriodEnd: true }),
      ],
      nextCursor: null,
    });
    render(
      <MemoryRouter>
        <SubscriptionsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Comunidade 1')).toBeInTheDocument();
    expect(screen.getAllByText('Ativa').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Em atraso (tolerância)').length).toBeGreaterThan(0);
    expect(screen.getByText('Stripe: past_due')).toBeInTheDocument();
    expect(screen.getByText('Agendado')).toBeInTheDocument();
    // somente consulta: nenhum controle que altere a assinatura
    expect(screen.queryByRole('button', { name: /ativar|pagar|marcar|cancelar assinatura/i })).toBeNull();
  });

  it('PAGINACAO: "Carregar mais" pede a pagina seguinte pelo cursor e acrescenta as linhas', async () => {
    h.call.mockImplementation(async (_name: string, _body: unknown, opts?: { query?: Record<string, string> }) =>
      opts?.query?.['cursor'] === 'cursor-2'
        ? { subscriptions: [item(3)], nextCursor: null }
        : { subscriptions: [item(1), item(2)], nextCursor: 'cursor-2' },
    );
    render(
      <MemoryRouter>
        <SubscriptionsPage />
      </MemoryRouter>,
    );
    await screen.findByText('Comunidade 2');
    expect(screen.queryByText('Comunidade 3')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));
    expect(await screen.findByText('Comunidade 3')).toBeInTheDocument();
    expect(screen.getByText('Comunidade 1')).toBeInTheDocument();
    expect(h.call).toHaveBeenLastCalledWith('platformSubscriptions', undefined, { query: { cursor: 'cursor-2' } });
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
  });

  it('FILTRO: por estado e por busca, refazendo a consulta do comeco', async () => {
    h.call.mockResolvedValue({ subscriptions: [item(1)], nextCursor: null });
    render(
      <MemoryRouter>
        <SubscriptionsPage />
      </MemoryRouter>,
    );
    await screen.findByText('Comunidade 1');

    fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'PAST_DUE_BLOCKED' } });
    await waitFor(() => expect(h.call).toHaveBeenLastCalledWith('platformSubscriptions', undefined, { query: { state: 'PAST_DUE_BLOCKED' } }));

    fireEvent.change(screen.getByLabelText('Comunidade'), { target: { value: '  alfa  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() =>
      expect(h.call).toHaveBeenLastCalledWith('platformSubscriptions', undefined, { query: { state: 'PAST_DUE_BLOCKED', q: 'alfa' } }),
    );
  });

  it('sem resultado para o filtro: diz isso; erro: mostra com opcao de tentar de novo', async () => {
    h.call.mockResolvedValueOnce({ subscriptions: [], nextCursor: null });
    const { unmount } = render(
      <MemoryRouter>
        <SubscriptionsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Nenhuma assinatura encontrada')).toBeInTheDocument();
    unmount();

    h.call.mockRejectedValueOnce(new ApiClientError({ code: 'INTERNAL', message: 'Erro interno. Tente novamente em instantes.', status: 500 }));
    render(
      <MemoryRouter>
        <SubscriptionsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

const saude = (extra: Partial<PlatformHealthResponse> = {}): PlatformHealthResponse => ({
  generatedAt: '2026-09-30T18:00:00.000Z',
  worker: 'ok',
  jobs: [
    {
      name: 'renovar-credenciais-pagamento',
      intervalSeconds: 3600,
      lastStartedAt: '2026-09-30T17:00:00.000Z',
      lastFinishedAt: '2026-09-30T17:00:01.000Z',
      lastSuccessAt: '2026-09-30T17:00:01.000Z',
      lastDurationMs: 12,
      lastCount: 0,
      lastError: null,
      consecutiveFailures: 0,
      stale: false,
    },
  ],
  deadLetter: { count: 0, oldestAt: null },
  outboxPending: { count: 0, oldestAt: null },
  reconciliation: { openIssues: 0, manualRefunds: 0 },
  stripeEvents: { failed: 0, dead: 0, pending: 0, oldestProblemAt: null },
  paymentAccounts: {
    authorizationsError: 0,
    authorizationsRevoked: 0,
    accountsDisconnecting: 0,
    unavailableIssues: { count: 0, items: [] },
  },
  ...extra,
});

describe('Console · Saude financeira', () => {
  it('mostra os alertas: eventos da Stripe com falha/mortos, autorizacoes com erro/revogadas, desconexoes e divergencias', async () => {
    h.call.mockResolvedValue(
      saude({
        stripeEvents: { failed: 2, dead: 1, pending: 3, oldestProblemAt: '2026-09-29T10:00:00.000Z' },
        paymentAccounts: {
          authorizationsError: 1,
          authorizationsRevoked: 4,
          accountsDisconnecting: 2,
          unavailableIssues: {
            count: 1,
            items: [{ id: 'i1', tenantName: 'Clube do Bairro', tenantSlug: 'clube-do-bairro', reference: 'a1b2c3d4', detectedAt: '2026-09-30T15:00:00.000Z' }],
          },
        },
      }),
    );
    const { container } = render(
      <MemoryRouter>
        <HealthPage />
      </MemoryRouter>,
    );
    const stripe = (await screen.findByRole('heading', { name: /Cobrança das assinaturas/ })).closest('section')!;
    expect(within(stripe).getByText('Eventos com falha (serão reprocessados)')).toBeInTheDocument();
    expect(within(stripe).getAllByText('Atenção').length).toBe(2);

    const pay = screen.getByRole('heading', { name: /Recebimentos das comunidades/ }).closest('section')!;
    expect(within(pay).getByText('Autorizações com erro')).toBeInTheDocument();
    expect(within(pay).getByText('Autorizações revogadas')).toBeInTheDocument();
    expect(within(pay).getByText('Contas desconectando (aguardando operações em andamento)')).toBeInTheDocument();
    // divergencia PAYMENT_AUTHORIZATION_UNAVAILABLE: comunidade, referencia segura e data
    const tabela = within(pay).getByRole('table', { name: 'Pagamentos com autorização indisponível' });
    expect(within(tabela).getByText('Clube do Bairro')).toBeInTheDocument();
    expect(within(tabela).getByText('a1b2c3d4')).toBeInTheDocument();
    expect(within(tabela).getByText('Em aberto · ação manual')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/access_token|refresh_token|APP_USR|client_secret/i);
  });

  it('tudo em ordem: indicadores sem alerta e os jobs novos aparecem com descricao', async () => {
    h.call.mockResolvedValue(saude());
    render(
      <MemoryRouter>
        <HealthPage />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: /Cobrança das assinaturas/ });
    expect(screen.queryAllByText('Atenção')).toHaveLength(0);
    expect(screen.getAllByText('Em ordem').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('Renova as autorizações do Mercado Pago antes de vencerem')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Pagamentos com autorização indisponível' })).toBeNull();
  });

  it('mais divergencias do que as mostradas: avisa quantas existem', async () => {
    h.call.mockResolvedValue(
      saude({
        paymentAccounts: {
          authorizationsError: 0,
          authorizationsRevoked: 0,
          accountsDisconnecting: 0,
          unavailableIssues: { count: 25, items: [{ id: 'i1', tenantName: 'A', tenantSlug: 'a', reference: 'r1', detectedAt: '2026-09-30T15:00:00.000Z' }] },
        },
      }),
    );
    render(
      <MemoryRouter>
        <HealthPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Mostrando as 1 mais antigas de 25/)).toBeInTheDocument();
  });
});
