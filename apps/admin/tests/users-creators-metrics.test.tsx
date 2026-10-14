import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, type PlatformCreator, type PlatformMetrics, type PlatformUser } from '@clubedarifa/shared';

const h = vi.hoisted(() => ({ call: vi.fn() }));

vi.mock('../src/api.ts', () => ({ api: { call: h.call } }));
vi.mock('../src/state/SessionProvider.tsx', () => ({
  useSession: () => ({ can: () => true }),
}));

import { CreatorsPage } from '../src/pages/CreatorsPage.tsx';
import { MetricsPage } from '../src/pages/MetricsPage.tsx';
import { UsersPage } from '../src/pages/UsersPage.tsx';

/** Super Admin: usuarios, criadores e metricas. Somente leitura; nunca ha credencial na tela. */

const usuario = (extra: Partial<PlatformUser> = {}): PlatformUser => ({
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Ana Souza',
  email: 'ana@exemplo.com',
  status: 'ACTIVE',
  createdAt: '2026-10-01T12:00:00.000Z',
  membershipsCount: 1,
  ordersCount: 3,
  platformRoles: [],
  ...extra,
});

const criador = (extra: Partial<PlatformCreator> = {}): PlatformCreator => ({
  tenantId: '22222222-2222-4222-8222-222222222222',
  slug: 'rifas-da-maria',
  name: 'Rifas da Maria',
  status: 'ACTIVE',
  createdAt: '2026-10-02T12:00:00.000Z',
  owners: [{ userId: '33333333-3333-4333-8333-333333333333', displayName: 'Maria Dona', email: 'maria@exemplo.com' }],
  planName: 'Profissional',
  subscriptionStatus: 'active',
  paymentAccountStatus: 'CONNECTED',
  publicDraws: 4,
  activeDraws: 2,
  ...extra,
});

const metricas = (extra: Partial<PlatformMetrics> = {}): PlatformMetrics => ({
  generatedAt: '2026-10-13T12:00:00.000Z',
  users: { total: 120, active: 118 },
  communities: { total: 9, active: 8 },
  creatorsWithPublishedDraw: 5,
  drawsByStatus: { ATIVA: 7, RASCUNHO: 3 },
  subscriptionsByStatus: { active: 4 },
  orders: { paid: 42, grossPaidCents: 123456 },
  ...extra,
});

beforeEach(() => {
  h.call.mockReset();
});

describe('Admin · usuarios', () => {
  it('lista, pagina e busca sem mostrar credencial', async () => {
    h.call.mockImplementation(async (_name: string, _body: unknown, opts?: { query?: Record<string, string> }) => {
      if (opts?.query?.['cursor']) return { users: [usuario({ id: '44444444-4444-4444-8444-444444444444', displayName: 'Bia Lima', email: 'bia@exemplo.com' })], nextCursor: null };
      return { users: [usuario()], nextCursor: 'proxima' };
    });
    render(<MemoryRouter><UsersPage /></MemoryRouter>);

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('ana@exemplo.com')).toBeInTheDocument();
    expect(screen.queryByText(/senha|hash|token/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));
    expect(await screen.findByText('Bia Lima')).toBeInTheDocument();
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Buscar por nome ou e-mail'), { target: { value: 'bia' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    await waitFor(() =>
      expect(h.call).toHaveBeenLastCalledWith('platformUsers', undefined, { query: { q: 'bia' } }),
    );
  });

  it('erro da API vira estado de erro, nao tela vazia', async () => {
    h.call.mockRejectedValue(new ApiClientError({ code: 'INTERNAL', message: 'Erro interno.', status: 500 }));
    render(<MemoryRouter><UsersPage /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('Admin · criadores', () => {
  it('mostra donos, plano, recebimento e rifas', async () => {
    h.call.mockResolvedValue({ creators: [criador(), criador({ tenantId: '55555555-5555-4555-8555-555555555555', slug: 'sem-recebimento', name: 'Sem Recebimento', planName: null, subscriptionStatus: null, paymentAccountStatus: null, publicDraws: 0, activeDraws: 0 })], nextCursor: null });
    render(<MemoryRouter><CreatorsPage /></MemoryRouter>);

    expect(await screen.findByText('Rifas da Maria')).toBeInTheDocument();
    expect(screen.getAllByText('Maria Dona').length).toBeGreaterThan(0);
    expect(screen.getByText('Profissional')).toBeInTheDocument();
    expect(screen.getByText('Conectada')).toBeInTheDocument();
    expect(screen.getByText('Não conectado')).toBeInTheDocument();
  });
});

describe('Admin · metricas', () => {
  it('mostra os numeros reais e o valor bruto quando a API o devolve', async () => {
    h.call.mockResolvedValue(metricas());
    render(<MemoryRouter><MetricsPage /></MemoryRouter>);
    expect(await screen.findByText('Usuários')).toBeInTheDocument();
    expect(screen.getByText('118 ativos')).toBeInTheDocument();
    expect(screen.getByText('Valor bruto dos pedidos pagos')).toBeInTheDocument();
    expect(screen.getByText('Ativa')).toBeInTheDocument();
  });

  it('sem permissao financeira o valor bruto nao aparece', async () => {
    h.call.mockResolvedValue(metricas({ orders: { paid: 42, grossPaidCents: null } }));
    render(<MemoryRouter><MetricsPage /></MemoryRouter>);
    expect(await screen.findByText('Pedidos pagos')).toBeInTheDocument();
    expect(screen.queryByText('Valor bruto dos pedidos pagos')).toBeNull();
  });
});
