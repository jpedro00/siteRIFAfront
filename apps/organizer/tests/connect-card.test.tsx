import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, type PaymentAccount } from '@clubedarifa/shared';

const h = vi.hoisted(() => ({ call: vi.fn(), redirectTo: vi.fn() }));

vi.mock('../src/api.ts', () => ({ api: { call: h.call } }));
vi.mock('../src/lib/navigate.ts', () => ({ redirectTo: h.redirectTo }));

import { ConnectCard, humanizeRequirements } from '../src/components/ConnectCard.tsx';

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

function abrir(props: Partial<ComponentProps<typeof ConnectCard>> = {}, url = '/recebimentos') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ConnectCard accounts={[]} canManage {...props} />
      <Local />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.call.mockReset();
  h.redirectTo.mockReset();
});

describe('ConnectCard · estados', () => {
  it('sem conta: explica e oferece "Cadastrar recebimento"', () => {
    abrir();
    expect(screen.getByRole('heading', { name: 'Conta Rifas (Stripe)' })).toBeInTheDocument();
    expect(screen.getByText(/cai direto na sua conta e a plataforma retém a taxa do plano/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar recebimento' })).toBeEnabled();
  });

  it('em andamento: lista o que falta e oferece "Continuar cadastro"', () => {
    abrir({ accounts: [conta({ requirementsDue: ['individual.verification.document', 'external_account'] })] });
    expect(screen.getByText('Cadastro em andamento')).toBeInTheDocument();
    expect(screen.getByText('O que ainda falta:')).toBeInTheDocument();
    expect(screen.getByText('Conta bancária para receber os repasses')).toBeInTheDocument();
    expect(screen.getByText('Documento de identidade')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar cadastro' })).toBeEnabled();
  });

  it('pronta: "Recebimento ativo" em texto e sem botao de cadastro', () => {
    abrir({ accounts: [conta({ canReceivePayments: true, chargesEnabled: true, payoutsEnabled: true })] });
    expect(screen.getByText('Recebimento ativo')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
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

describe('ConnectCard · avisos vindos da pagina', () => {
  it('link expirado: avisa e oferece continuar', () => {
    abrir({ accounts: [conta()], linkExpirou: true });
    expect(screen.getByText('O link de cadastro expirou')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar cadastro' })).toBeInTheDocument();
  });

  it('erro externo aparece', () => {
    abrir({ erro: 'Sem MFA.' });
    expect(screen.getByText('Sem MFA.')).toBeInTheDocument();
  });
});

describe('ConnectCard · escolha da conta', () => {
  it('conta desconectada ou revogada conta como "sem cadastro"', () => {
    abrir({ accounts: [conta({ status: 'DISCONNECTED', requirementsDue: ['external_account'] }), conta({ id: '5', status: 'REVOKED' })] });
    expect(screen.getByRole('button', { name: 'Cadastrar recebimento' })).toBeInTheDocument();
    expect(screen.queryByText('Cadastro em andamento')).toBeNull();
  });

  it('prefere a conta CONNECTED a uma mais nova com outro estado', () => {
    abrir({
      accounts: [
        conta({ id: '1', status: 'CONNECTED', requirementsDue: ['external_account'] }),
        conta({ id: '2', status: 'ERROR', connectedAt: '2026-10-05T12:00:00.000Z', requirementsDue: ['individual.dob.day'] }),
      ],
    });
    expect(screen.getByText('Conta bancária para receber os repasses')).toBeInTheDocument();
    expect(screen.queryByText('Data de nascimento')).toBeNull();
  });
});

describe('humanizeRequirements', () => {
  it.each([
    ['individual.dob.day', 'Data de nascimento'],
    ['individual.address.line1', 'Endereço'],
    ['individual.id_number', 'CPF'],
    ['individual.verification.document', 'Documento de identidade'],
    ['individual.verification.additional_document', 'Documento de identidade'],
    ['individual.first_name', 'Nome completo'],
    ['individual.last_name', 'Nome completo'],
    ['individual.phone', 'Telefone'],
    ['individual.email', 'E-mail'],
    ['individual.political_exposure', 'Declaração de exposição política'],
    ['business_profile.url', 'Dados do negócio'],
    ['business_profile.mcc', 'Dados do negócio'],
    ['business_profile.product_description', 'Dados do negócio'],
    ['external_account', 'Conta bancária para receber os repasses'],
    ['tos_acceptance.date', 'Aceite dos termos da Stripe'],
    ['company.tax_id', 'Dados da empresa'],
    ['representative.dob.day', 'Dados do responsável'],
  ])('%s -> %s', (codigo, texto) => {
    expect(humanizeRequirements([codigo])).toEqual([texto]);
  });

  it('remove repeticoes e mantem ordem estavel', () => {
    expect(humanizeRequirements(['external_account', 'individual.dob.day', 'individual.dob.month', 'individual.first_name'])).toEqual([
      'Nome completo',
      'Data de nascimento',
      'Conta bancária para receber os repasses',
    ]);
  });

  it('codigo desconhecido vira uma linha fixa, sem expor o codigo', () => {
    expect(humanizeRequirements(['foo.bar', 'baz'])).toEqual(['Outras informações pedidas pela Stripe']);
    expect(humanizeRequirements([])).toEqual([]);
  });
});
