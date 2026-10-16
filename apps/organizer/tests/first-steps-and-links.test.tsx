import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ permissions: new Set<string>(), call: vi.fn() }));

vi.mock('../src/api.ts', () => ({ api: { call: h.call } }));

vi.mock('../src/state/SessionProvider.tsx', () => ({
  useSession: () => ({ can: (p: string) => h.permissions.has(p) }),
}));

import { FirstStepsChecklist } from '../src/components/FirstStepsChecklist.tsx';

/** Primeiros passos do criador novo: so leva a telas que existem e respeita permissao. */

beforeEach(() => {
  h.permissions.clear();
  h.call.mockReset();
  h.call.mockResolvedValue({ enabled: true, accounts: [], checkoutAvailable: false });
});
afterEach(() => vi.unstubAllEnvs());

function montar() {
  return render(
    <MemoryRouter>
      <FirstStepsChecklist />
    </MemoryRouter>,
  );
}

describe('checklist de primeiros passos', () => {
  it('dono ve os quatro passos e o CTA para criar a primeira rifa', () => {
    for (const p of ['tenant:read', 'payment_account:read', 'billing:read', 'draw:write']) h.permissions.add(p);
    montar();
    expect(screen.getByText(/Complete sua comunidade/)).toBeInTheDocument();
    expect(screen.getByText(/Configure seus recebimentos/)).toBeInTheDocument();
    expect(screen.getByText(/Confira sua assinatura/)).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: /Criar minha primeira rifa/ });
    expect(cta).toHaveAttribute('href', '/sorteios/novo');
  });

  it('quem nao tem permissao nao ve o passo nem o CTA', () => {
    h.permissions.add('tenant:read');
    montar();
    expect(screen.getByText(/Complete sua comunidade/)).toBeInTheDocument();
    expect(screen.queryByText(/Configure seus recebimentos/)).toBeNull();
    expect(screen.queryByText(/Confira sua assinatura/)).toBeNull();
    expect(screen.queryByRole('link', { name: /Criar minha primeira rifa/ })).toBeNull();
  });
});

describe('checklist · passo de recebimentos', () => {
  const conta = (provider: string, canReceivePayments: boolean) => ({ id: provider, provider, canReceivePayments });

  it('conta Stripe pronta conclui o passo (nao so Mercado Pago)', async () => {
    h.permissions.add('payment_account:read');
    h.call.mockResolvedValue({ enabled: true, accounts: [conta('STRIPE', true)], checkoutAvailable: true });
    montar();
    expect(await screen.findByText(/Configure seus recebimentos \(concluído\)/)).toBeInTheDocument();
  });

  it('conta Mercado Pago pronta tambem conclui', async () => {
    h.permissions.add('payment_account:read');
    h.call.mockResolvedValue({ enabled: true, accounts: [conta('MERCADO_PAGO', true)], checkoutAvailable: true });
    montar();
    expect(await screen.findByText(/\(concluído\)/)).toBeInTheDocument();
  });

  it('sem conta pronta o passo segue pendente', async () => {
    h.permissions.add('payment_account:read');
    h.call.mockResolvedValue({ enabled: true, accounts: [conta('STRIPE', false)], checkoutAvailable: false });
    montar();
    await waitFor(() => expect(h.call).toHaveBeenCalledWith('tenantPaymentAccounts', undefined, expect.anything()));
    expect(screen.getByText(/Configure seus recebimentos/)).toBeInTheDocument();
    expect(screen.queryByText(/concluído/)).toBeNull();
  });
});

describe('enderecos do site publico a partir do painel', () => {
  it('modo central: vitrine em /criador/:slug e volta ao Clube; sem base, nada e mostrado', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_STOREFRONT_BASE_URL', 'https://site.exemplo/');
    vi.stubEnv('VITE_MARKETPLACE_MODE', 'central');
    const central = await import('../src/lib/site.ts');
    expect(central.vitrineUrl('rifas-da-maria')).toBe('https://site.exemplo/criador/rifas-da-maria');
    expect(central.clubeUrl()).toBe('https://site.exemplo/');
    expect(central.esqueciSenhaUrl()).toBe('https://site.exemplo/esqueci-senha');
    expect(central.queroCriarUrl()).toBe('https://site.exemplo/quero-criar-rifas');
    expect(central.vitrineUrl(undefined)).toBeNull();

    vi.resetModules();
    vi.stubEnv('VITE_STOREFRONT_BASE_URL', '');
    const vazio = await import('../src/lib/site.ts');
    expect(vazio.vitrineUrl('x')).toBeNull();
    expect(vazio.clubeUrl()).toBeNull();
    expect(vazio.esqueciSenhaUrl()).toBeNull();
  });

  it('modo por comunidade: a vitrine e a raiz do site e nao ha "Voltar ao Clube"', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_STOREFRONT_BASE_URL', 'https://site.exemplo');
    vi.stubEnv('VITE_MARKETPLACE_MODE', '');
    const tenant = await import('../src/lib/site.ts');
    expect(tenant.vitrineUrl('qualquer')).toBe('https://site.exemplo/');
    expect(tenant.clubeUrl()).toBeNull();
  });
});
