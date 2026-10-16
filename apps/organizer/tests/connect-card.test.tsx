import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, type PaymentAccount } from '@clubedarifa/shared';

const h = vi.hoisted(() => ({ call: vi.fn(), redirectTo: vi.fn() }));

vi.mock('../src/api.ts', () => ({ api: { call: h.call } }));
vi.mock('../src/lib/navigate.ts', () => ({ redirectTo: h.redirectTo }));

import { ConnectCard } from '../src/components/ConnectCard.tsx';

/** Cartao "Conta Rifas (Stripe)": estados, redirecionamento e volta da Stripe. */

const conta = (extra: Partial<PaymentAccount> = {}): PaymentAccount => ({
  id: '44444444-4444-4444-8444-444444444444',
  provider: 'STRIPE',
  environment: 'SANDBOX',
  status: 'CONNECTED',
  providerAccountId: 'acct_123',
  authorizationStatus: 'ACTIVE',
  tokenExpiresAt: null,
  lastVerifiedAt: null,
  lastError: null,
  connectedAt: '2026-10-01T12:00:00.000Z',
  disconnectRequestedAt: null,
  canReceivePayments: false,
  openObligations: 0,
  chargesEnabled: false,
  payoutsEnabled: false,
  requirementsDue: [],
  ...extra,
});

function Local() {
  const l = useLocation();
  return <output data-testid="local">{`${l.pathname}${l.search}`}</output>;
}

const onChanged = vi.fn();

function abrir(props: Partial<ComponentProps<typeof ConnectCard>> = {}, url = '/recebimentos') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ConnectCard accounts={[]} enabled canManage onChanged={onChanged} {...props} />
      <Local />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.call.mockReset();
  h.redirectTo.mockReset();
  onChanged.mockReset();
});

describe('ConnectCard · estados', () => {
  it('sem conta: explica e oferece "Cadastrar recebimento"', () => {
    abrir();
    expect(screen.getByRole('heading', { name: 'Conta Rifas (Stripe)' })).toBeInTheDocument();
    expect(screen.getByText(/cai na conta do criador e a plataforma retém a taxa do plano/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar recebimento' })).toBeEnabled();
  });

  it('em andamento: lista o que falta e oferece "Continuar cadastro"', () => {
    abrir({ accounts: [conta({ requirementsDue: ['individual.verification.document', 'external_account'] })] });
    expect(screen.getByText('Cadastro em andamento')).toBeInTheDocument();
    expect(screen.getByText('O que ainda falta:')).toBeInTheDocument();
    expect(screen.getByText('Conta bancária ou chave PIX para receber')).toBeInTheDocument();
    expect(screen.getByText('Informação pendente: document')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar cadastro' })).toBeEnabled();
  });

  it('pronta: "Recebimento ativo" em texto e sem botao de cadastro', () => {
    abrir({ accounts: [conta({ canReceivePayments: true, chargesEnabled: true, payoutsEnabled: true })] });
    expect(screen.getByText('Recebimento ativo')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('modulo desligado: o cartao nao aparece', () => {
    const { container } = abrir({ enabled: false });
    expect(container.querySelector('article')).toBeNull();
  });

  it('sem permissao de gerir: so o estado, sem botoes', () => {
    abrir({ canManage: false, accounts: [conta({ requirementsDue: ['external_account'] })] });
    expect(screen.getByText('Cadastro em andamento')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/Somente o proprietário/)).toBeInTheDocument();
  });

  it('ignora contas do Mercado Pago', () => {
    abrir({ accounts: [conta({ provider: 'MERCADO_PAGO', canReceivePayments: true })] });
    expect(screen.getByRole('button', { name: 'Cadastrar recebimento' })).toBeInTheDocument();
  });
});

describe('ConnectCard · acao', () => {
  it('o clique chama a rota e vai para a pagina da Stripe', async () => {
    h.call.mockResolvedValue({ url: 'https://connect.stripe.com/setup/abc' });
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar recebimento' }));
    await waitFor(() => expect(h.redirectTo).toHaveBeenCalledWith('https://connect.stripe.com/setup/abc'));
    expect(h.call).toHaveBeenCalledWith('connectStripeAccount');
  });

  it('MFA exigida: mostra a mensagem da API, nao navega e libera o botao', async () => {
    h.call.mockRejectedValue(
      new ApiClientError({ code: 'MFA_REQUIRED', message: 'Confirme a verificação em duas etapas para continuar.', status: 403 }),
    );
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar recebimento' }));
    expect(await screen.findByText('Confirme a verificação em duas etapas para continuar.')).toBeInTheDocument();
    expect(h.redirectTo).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cadastrar recebimento' })).toBeEnabled();
  });
});

describe('ConnectCard · volta da Stripe', () => {
  it('?connect=return: atualiza UMA vez, recarrega e limpa a URL', async () => {
    h.call.mockResolvedValue({ enabled: true, accounts: [], checkoutAvailable: false });
    abrir({}, '/recebimentos?connect=return&x=1');
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(h.call).toHaveBeenCalledTimes(1);
    expect(h.call).toHaveBeenCalledWith('refreshStripeAccount');
    expect(screen.getByTestId('local')).toHaveTextContent('/recebimentos?x=1');
  });

  it('?connect=refresh: avisa que o link expirou e oferece continuar', async () => {
    h.call.mockResolvedValue({ enabled: true, accounts: [], checkoutAvailable: false });
    abrir({ accounts: [conta()] }, '/recebimentos?connect=refresh');
    expect(await screen.findByText('O link de cadastro expirou')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar cadastro' })).toBeInTheDocument();
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it('falha ao atualizar: mostra o erro e ainda recarrega a lista', async () => {
    h.call.mockRejectedValue(new ApiClientError({ code: 'MFA_REQUIRED', message: 'Sem MFA.', status: 403 }));
    abrir({}, '/recebimentos?connect=return');
    expect(await screen.findByText('Sem MFA.')).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('sem ?connect nada e chamado', () => {
    abrir();
    expect(h.call).not.toHaveBeenCalled();
  });
});
