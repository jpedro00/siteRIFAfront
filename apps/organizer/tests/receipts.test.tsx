import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, type PaymentAccount, type PaymentAccountsResponse } from '@clubedarifa/shared';

const h = vi.hoisted(() => ({
  call: vi.fn(),
  redirectTo: vi.fn(),
  permissions: new Set<string>(),
  confirm: vi.fn(),
}));

vi.mock('../src/api.ts', () => ({ api: { call: h.call } }));
vi.mock('../src/lib/navigate.ts', () => ({ redirectTo: h.redirectTo }));
vi.mock('../src/state/SessionProvider.tsx', () => ({
  useSession: () => ({ can: (p: string) => h.permissions.has(p), tenant: { name: 'Clube', roles: ['OWNER'] } }),
}));

import { ReceiptsPage } from '../src/pages/ReceiptsPage.tsx';

/**
 * "Recebimentos": a conexao do Mercado Pago por OAuth. A tela nunca pede credencial; o que
 * aparece e so o estado da conexao e um identificador mascarado.
 */

const conta = (extra: Partial<PaymentAccount> = {}): PaymentAccount => ({
  id: '33333333-3333-4333-8333-333333333333',
  provider: 'MERCADO_PAGO',
  environment: 'SANDBOX',
  status: 'CONNECTED',
  providerAccountId: '123456789',
  authorizationStatus: 'ACTIVE',
  tokenExpiresAt: '2027-03-01T12:00:00.000Z',
  lastVerifiedAt: '2026-09-30T12:00:00.000Z',
  lastError: null,
  connectedAt: '2026-09-01T12:00:00.000Z',
  disconnectRequestedAt: null,
  canReceivePayments: true,
  openObligations: 0,
  ...extra,
});

const resposta = (accounts: PaymentAccount[], extra: Partial<PaymentAccountsResponse> = {}): PaymentAccountsResponse => ({
  enabled: true,
  accounts,
  checkoutAvailable: accounts.some((a) => a.canReceivePayments),
  ...extra,
});

/** Sequencia de respostas para `tenantPaymentAccounts` (a 2a vale depois de recarregar). */
function contas(...respostas: PaymentAccountsResponse[]) {
  let i = 0;
  h.call.mockImplementation(async (name: string) => {
    if (name === 'tenantPaymentAccounts') return respostas[Math.min(i++, respostas.length - 1)];
    throw new Error(`chamada inesperada: ${name}`);
  });
}

function Local() {
  const l = useLocation();
  return <output data-testid="local">{`${l.pathname}${l.search}`}</output>;
}

function abrir(url = '/recebimentos') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ReceiptsPage />
      <Local />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.call.mockReset();
  h.redirectTo.mockReset();
  h.confirm.mockReset();
  h.permissions = new Set(['payment_account:read', 'payment_account:manage']);
  vi.stubGlobal('confirm', h.confirm);
});

describe('Recebimentos · estados da conta', () => {
  it('SEM conta: explica para que serve e oferece conectar, sem pedir nenhuma credencial', async () => {
    contas(resposta([]));
    abrir();
    expect(await screen.findByText('Nenhuma conta conectada')).toBeInTheDocument();
    expect(screen.getByText(/conta que receberá os pagamentos dos participantes/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Conectar Mercado Pago' })).toBeEnabled();
    // nada de campo para token, chave ou segredo
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(document.body.textContent).not.toMatch(/access token|client secret|refresh/i);
  });

  it('CONNECTED: mostra so dados seguros, com o identificador mascarado, e a nota sobre troca de conta', async () => {
    contas(resposta([conta()]));
    const { container } = abrir();
    expect(await screen.findByText('Novos pagamentos dos participantes entram nesta conta.')).toBeInTheDocument();
    expect(screen.getAllByText('Conectada').length).toBeGreaterThan(0);
    expect(screen.getByText('•••• 6789')).toBeInTheDocument();
    expect(screen.queryByText('123456789')).toBeNull();
    expect(screen.getByText('Testes')).toBeInTheDocument();
    expect(screen.getByText(/afeta apenas novos pagamentos/)).toBeInTheDocument();
    expect(screen.getByText(/permanecem vinculadas à conta utilizada originalmente/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/APP_USR|TG-|encrypted|verifier/i);
  });

  it('DISCONNECTING: explica que nao aceita novos pagamentos e NAO oferece reconectar', async () => {
    contas(resposta([conta({ status: 'DISCONNECTING', canReceivePayments: false, openObligations: 2 })], { checkoutAvailable: false }));
    abrir();
    expect(
      await screen.findByText('A conexão não aceita novos pagamentos, mas ainda está sendo mantida para concluir operações existentes.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Operações em andamento')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Conectar/ })).toBeNull();
    expect(screen.getByText(/Aguarde a conclusão da desconexão/)).toBeInTheDocument();
  });

  it('REVOKED: pede atencao, nao afirma que da para consultar pagamentos e oferece reconectar', async () => {
    contas(resposta([conta({ status: 'REVOKED', authorizationStatus: 'REVOKED', canReceivePayments: false })], { checkoutAvailable: false }));
    abrir();
    expect(await screen.findByText(/O acesso a esta conta foi revogado no Mercado Pago/)).toBeInTheDocument();
    expect(screen.getByText(/podem precisar de atenção manual/)).toBeInTheDocument();
    expect(screen.getAllByText('Acesso revogado').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Conectar novamente' })).toBeEnabled();
    expect(document.body.textContent).not.toMatch(/consultados normalmente/);
  });

  it('ERROR: pede atencao e nao garante a consulta dos pagamentos em andamento', async () => {
    contas(resposta([conta({ status: 'ERROR', authorizationStatus: 'ERROR', canReceivePayments: false })], { checkoutAvailable: false }));
    abrir();
    expect(await screen.findByText(/Não é possível garantir a consulta dos pagamentos em andamento/)).toBeInTheDocument();
    expect(screen.getAllByText('Precisa de atenção').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Conectar novamente' })).toBeInTheDocument();
  });

  it('modulo desligado no ambiente: diz isso e nao mostra botao que nao funcionaria', async () => {
    contas(resposta([], { enabled: false }));
    abrir();
    expect(await screen.findByText('Conexão ainda não habilitada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Conectar/ })).toBeNull();
  });

  it('quem so le nao conecta nem desconecta', async () => {
    h.permissions = new Set(['payment_account:read']);
    contas(resposta([conta()]));
    abrir();
    await screen.findByText('Novos pagamentos dos participantes entram nesta conta.');
    expect(screen.queryByRole('button', { name: /Desconectar|Conectar/ })).toBeNull();
  });
});

describe('Recebimentos · conexao OAuth', () => {
  it('inicia: pede a URL ao servidor (so o provedor) e navega para ela', async () => {
    h.call.mockImplementation(async (name: string) => {
      if (name === 'tenantPaymentAccounts') return resposta([]);
      if (name === 'connectPaymentAccount') return { url: 'https://auth.mercadopago.test/authorization?state=abc' };
      throw new Error(`inesperada: ${name}`);
    });
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Conectar Mercado Pago' }));
    await waitFor(() => expect(h.redirectTo).toHaveBeenCalledWith('https://auth.mercadopago.test/authorization?state=abc'));
    expect(h.call).toHaveBeenCalledWith('connectPaymentAccount', { provider: 'MERCADO_PAGO' });
  });

  it('falha ao iniciar (MFA, limite de tentativas...): mostra a mensagem da API e nao navega', async () => {
    h.call.mockImplementation(async (name: string) => {
      if (name === 'tenantPaymentAccounts') return resposta([]);
      throw new ApiClientError({ code: 'MFA_REQUIRED', message: 'Confirme a verificação em duas etapas para continuar.', status: 403 });
    });
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Conectar Mercado Pago' }));
    expect(await screen.findByText('Confirme a verificação em duas etapas para continuar.')).toBeInTheDocument();
    expect(h.redirectTo).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Conectar Mercado Pago' })).toBeEnabled();
  });

  it('retorno conexao=ok: mostra o feedback e RECARREGA o estado', async () => {
    contas(resposta([]), resposta([conta()]));
    abrir('/recebimentos?conexao=ok');
    expect(await screen.findByText('Conexão concluída')).toBeInTheDocument();
    // depois de recarregar, a conta aparece
    expect(await screen.findByText('•••• 6789')).toBeInTheDocument();
    expect(h.call.mock.calls.filter((c) => c[0] === 'tenantPaymentAccounts').length).toBeGreaterThanOrEqual(2);
  });

  it('retorno conexao=erro&motivo=...: traduz o motivo conhecido', async () => {
    contas(resposta([]));
    abrir('/recebimentos?conexao=erro&motivo=invalid_state');
    const aviso = await screen.findByRole('alert');
    expect(within(aviso).getByText('A conexão não foi concluída')).toBeInTheDocument();
    expect(within(aviso).getByText(/expirou ou já foi usado/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('invalid_state');
  });

  it('motivo DESCONHECIDO (ou malicioso) vira o texto generico e nunca e impresso', async () => {
    contas(resposta([]));
    abrir('/recebimentos?conexao=erro&motivo=' + encodeURIComponent('<img src=x onerror=alert(1)> stack trace at foo'));
    expect(await screen.findByText('Não foi possível concluir a conexão. Tente novamente.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/stack trace|onerror/);
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });

  it('LIMPA os parametros da URL (replace), para o F5 e o "voltar" nao repetirem o retorno', async () => {
    contas(resposta([]), resposta([conta()]));
    abrir('/recebimentos?conexao=erro&motivo=provider_denied');
    await screen.findByText(/cancelada no Mercado Pago/);
    await waitFor(() => expect(screen.getByTestId('local').textContent).toBe('/recebimentos'));
    // o aviso continua na tela depois de limpar a URL
    expect(screen.getByText(/cancelada no Mercado Pago/)).toBeInTheDocument();
  });

  it('sem retorno na URL, nada e anunciado', async () => {
    contas(resposta([]));
    abrir();
    await screen.findByText('Nenhuma conta conectada');
    expect(screen.queryByText('Conexão concluída')).toBeNull();
    expect(screen.queryByText('A conexão não foi concluída')).toBeNull();
  });
});

describe('Recebimentos · desconexao', () => {
  it('pede confirmacao DENTRO da tela (sem window.confirm), explica as consequencias e so entao chama a API', async () => {
    h.call.mockImplementation(async (name: string) => {
      if (name === 'tenantPaymentAccounts') return resposta([conta()]);
      if (name === 'disconnectPaymentAccount') return conta({ status: 'DISCONNECTING', canReceivePayments: false, openObligations: 1 });
      throw new Error(`inesperada: ${name}`);
    });
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Desconectar' }));

    const painel = await screen.findByRole('alertdialog');
    expect(within(painel).getByText('Desconectar esta conta?')).toBeInTheDocument();
    expect(within(painel).getByText(/Novos pagamentos deixarão de usar esta conta/)).toBeInTheDocument();
    expect(within(painel).getByText(/Pagamentos existentes continuarão sendo tratados/)).toBeInTheDocument();
    expect(within(painel).getByText(/pode ficar pendente enquanto houver obrigações financeiras/)).toBeInTheDocument();
    expect(painel.contains(document.activeElement)).toBe(true);
    expect(h.call).not.toHaveBeenCalledWith('disconnectPaymentAccount', expect.anything(), expect.anything());
    expect(h.confirm).not.toHaveBeenCalled();

    fireEvent.click(within(painel).getByRole('button', { name: 'Desconectar' }));
    await waitFor(() =>
      expect(h.call).toHaveBeenCalledWith('disconnectPaymentAccount', undefined, { params: { id: '33333333-3333-4333-8333-333333333333' } }),
    );
    expect(await screen.findByText(/Desconexão iniciada/)).toBeInTheDocument();
    expect(h.confirm).not.toHaveBeenCalled();
  });

  it('Cancelar (ou Esc) fecha o painel sem chamar a API', async () => {
    contas(resposta([conta()]));
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Desconectar' }));
    const painel = await screen.findByRole('alertdialog');
    fireEvent.keyDown(painel, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(h.call.mock.calls.some((c) => c[0] === 'disconnectPaymentAccount')).toBe(false);
    // o foco volta para quem abriu
    expect(screen.getByRole('button', { name: 'Desconectar' })).toHaveFocus();
  });

  it('desconexao concluida na hora: mostra DISCONNECTED (vindo da API, nao de palpite)', async () => {
    let desconectada = false;
    h.call.mockImplementation(async (name: string) => {
      if (name === 'tenantPaymentAccounts') return resposta([conta(desconectada ? { status: 'DISCONNECTED', canReceivePayments: false } : {})]);
      if (name === 'disconnectPaymentAccount') {
        desconectada = true;
        return conta({ status: 'DISCONNECTED', canReceivePayments: false });
      }
      throw new Error(`inesperada: ${name}`);
    });
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Desconectar' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Desconectar' }));
    expect(await screen.findByText('Conta desconectada.')).toBeInTheDocument();
    expect(await screen.findByText('Esta conta não recebe mais pagamentos.')).toBeInTheDocument();
  });

  it('erro ao desconectar: mostra a mensagem e NAO altera o estado na tela', async () => {
    h.call.mockImplementation(async (name: string) => {
      if (name === 'tenantPaymentAccounts') return resposta([conta()]);
      throw new ApiClientError({ code: 'MFA_REQUIRED', message: 'Confirme a verificação em duas etapas para continuar.', status: 403 });
    });
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Desconectar' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Desconectar' }));
    expect(await screen.findByText('Confirme a verificação em duas etapas para continuar.')).toBeInTheDocument();
    // continua conectada: nada foi apagado de forma otimista
    expect(screen.getByText('Novos pagamentos dos participantes entram nesta conta.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desconectar' })).toBeEnabled();
  });

  it('trocar de conta: o painel repete que so novos pagamentos mudam e so entao segue para o Mercado Pago', async () => {
    h.call.mockImplementation(async (name: string) => {
      if (name === 'tenantPaymentAccounts') return resposta([conta()]);
      if (name === 'connectPaymentAccount') return { url: 'https://auth.mercadopago.test/authorization?state=novo' };
      throw new Error(`inesperada: ${name}`);
    });
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Conectar outra conta' }));
    const painel = await screen.findByRole('alertdialog');
    expect(within(painel).getByText(/afeta apenas novos pagamentos/)).toBeInTheDocument();
    expect(h.redirectTo).not.toHaveBeenCalled();
    fireEvent.click(within(painel).getByRole('button', { name: 'Continuar no Mercado Pago' }));
    await waitFor(() => expect(h.redirectTo).toHaveBeenCalledWith('https://auth.mercadopago.test/authorization?state=novo'));
  });
});
