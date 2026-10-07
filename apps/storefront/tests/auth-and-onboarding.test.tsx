import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  call: vi.fn(),
  state: {
    sessionStatus: 'anonymous' as string,
    session: null as unknown,
    login: vi.fn(),
    verifyMfa: vi.fn(),
    enrollMfa: vi.fn(),
    confirmMfa: vi.fn(),
    logout: vi.fn(),
    refreshSession: vi.fn(),
  },
}));
vi.mock('../src/api.ts', () => ({
  api: { call: h.call, setMarketplaceTenant: vi.fn(), marketplaceTenant: null },
  apiBaseUrl: 'https://api.test',
}));
vi.mock('../src/state/SessionProvider.tsx', () => ({ useStorefront: () => h.state }));

import { AccountPage } from '../src/pages/AccountPage.tsx';
import { ForgotPasswordPage, ResetPasswordPage, tokenFromHash } from '../src/pages/PasswordPages.tsx';
import { CreatorOnboardingPage, slugFromName } from '../src/pages/CreatorOnboardingPage.tsx';
import { safeNext } from '../src/lib/next.ts';

const sessao = (memberships: unknown[] = []) => ({
  user: { id: 'u1', email: 'a@b.com', displayName: 'Ana Dona' },
  memberships,
});

beforeEach(() => {
  h.call.mockReset();
  Object.assign(h.state, { sessionStatus: 'anonymous', session: null });
  for (const fn of [h.state.login, h.state.verifyMfa, h.state.enrollMfa, h.state.confirmMfa, h.state.logout, h.state.refreshSession]) {
    fn.mockReset();
  }
});

describe('MFA na conta global', () => {
  it('perfil que EXIGE MFA e ainda nao tem fator vai para o cadastro do fator, nao para a verificacao', async () => {
    h.state.sessionStatus = 'mfa_enrollment_required';
    h.state.enrollMfa.mockResolvedValue({ secret: 'SEGREDOABC', otpauthUri: 'otpauth://totp/x' });
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /Ative a verificação em duas etapas/ })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Código de verificação/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Gerar chave' }));
    expect(await screen.findByText('SEGREDOABC')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Código gerado pelo aplicativo/), { target: { value: '123456' } });
    h.state.confirmMfa.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(h.state.confirmMfa).toHaveBeenCalledWith('123456'));
  });

  it('conta com fator pede o codigo (verificacao)', () => {
    h.state.sessionStatus = 'mfa_required';
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(/Código de verificação/)).toBeInTheDocument();
  });

  it('a tela de entrar oferece "Esqueci minha senha"', () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Esqueci minha senha' })).toHaveAttribute('href', '/esqueci-senha');
  });
});

describe('recuperacao de senha', () => {
  it('o pedido mostra a mensagem neutra (nao revela se o e-mail existe)', async () => {
    h.call.mockResolvedValue({ accepted: true });
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'qualquer@exemplo.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(await screen.findByText(/Se existir uma conta com esse e-mail/)).toBeInTheDocument();
    expect(h.call).toHaveBeenCalledWith('forgotPassword', { email: 'qualquer@exemplo.com' });
  });

  it('o token vem do fragmento da URL, e so entra no formato esperado', () => {
    expect(tokenFromHash('#token=abcdefghijklmnopqrstuvwxyz')).toBe('abcdefghijklmnopqrstuvwxyz');
    expect(tokenFromHash('#token=curto')).toBeNull();
    expect(tokenFromHash('')).toBeNull();
    expect(tokenFromHash('#outro=abcdefghijklmnopqrstuvwxyz')).toBeNull();
  });

  it('redefinir: valida a confirmacao no navegador, envia o token e o tira da barra de enderecos', async () => {
    window.history.replaceState(null, '', '/redefinir-senha#token=abcdefghijklmnopqrstuvwxyz123456');
    h.call.mockResolvedValue({ reset: true });
    render(
      <MemoryRouter>
        <ResetPasswordPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(window.location.hash).toBe(''));
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'Senha-Forte-2026!' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'Diferente-2026!!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    expect(await screen.findByText('As senhas não coincidem.')).toBeInTheDocument();
    expect(h.call).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'Senha-Forte-2026!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    expect(await screen.findByText(/Senha redefinida/)).toBeInTheDocument();
    expect(h.call).toHaveBeenCalledWith('resetPassword', {
      token: 'abcdefghijklmnopqrstuvwxyz123456',
      password: 'Senha-Forte-2026!',
      passwordConfirmation: 'Senha-Forte-2026!',
    });
  });

  it('link sem token valido oferece pedir outro, sem formulario', async () => {
    window.history.replaceState(null, '', '/redefinir-senha');
    render(
      <MemoryRouter>
        <ResetPasswordPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/inválido ou está incompleto/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Nova senha')).toBeNull();
  });
});

describe('onboarding do criador', () => {
  const rotas = () => (
    <MemoryRouter initialEntries={['/quero-criar-rifas']}>
      <Routes>
        <Route path="/quero-criar-rifas" element={<CreatorOnboardingPage />} />
        <Route path="/conta" element={<p>TELA DE CONTA</p>} />
      </Routes>
    </MemoryRouter>
  );

  it('anonimo: explica o caminho e leva a criar conta ou entrar, voltando para ca (mesma conta)', () => {
    render(rotas());
    expect(screen.getByRole('link', { name: 'Criar minha conta' })).toHaveAttribute('href', '/cadastro?next=%2Fquero-criar-rifas');
    expect(screen.getByRole('link', { name: 'Já tenho conta' })).toHaveAttribute('href', '/conta?next=%2Fquero-criar-rifas');
  });

  it('conta que ainda precisa cadastrar o MFA e enviada para a conta, nao fica presa', () => {
    h.state.sessionStatus = 'mfa_enrollment_required';
    render(rotas());
    expect(screen.getByText('TELA DE CONTA')).toBeInTheDocument();
  });

  it('logado sem comunidade: cria com o endereco sugerido pelo nome e NUNCA envia dono nem tenant', async () => {
    h.state.sessionStatus = 'authenticated';
    h.state.session = sessao([]);
    h.call.mockResolvedValue({ id: 't1', slug: 'rifas-do-joao', name: 'Rifas do João', status: 'ACTIVE', createdAt: '2026-10-07T00:00:00Z', created: true });
    h.state.refreshSession.mockResolvedValue(undefined);
    render(rotas());

    fireEvent.change(screen.getByLabelText('Nome da comunidade'), { target: { value: 'Rifas do João!' } });
    expect((screen.getByLabelText('Endereço') as HTMLInputElement).value).toBe('rifas-do-joao');
    fireEvent.click(screen.getByRole('button', { name: 'Criar comunidade' }));

    expect(await screen.findByText(/Você é a dona dela/)).toBeInTheDocument();
    expect(h.call).toHaveBeenCalledWith('createMyCommunity', { name: 'Rifas do João!', slug: 'rifas-do-joao' });
    expect(h.state.refreshSession).toHaveBeenCalled();
    // Cobranca de planos desligada: a tela nao inventa assinatura.
    expect(screen.getByText(/nada é cobrado nem simulado/)).toBeInTheDocument();
  });

  it('endereco reservado e recusado antes de chamar a API', async () => {
    h.state.sessionStatus = 'authenticated';
    h.state.session = sessao([]);
    render(rotas());
    fireEvent.change(screen.getByLabelText('Nome da comunidade'), { target: { value: 'Admin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar comunidade' }));
    expect(await screen.findByText(/reservado/)).toBeInTheDocument();
    expect(h.call).not.toHaveBeenCalled();
  });

  it('quem ja e dono ve "Voce ja e criador" com as comunidades, sem repetir o onboarding', () => {
    h.state.sessionStatus = 'authenticated';
    h.state.session = sessao([{ tenantId: 't1', tenantSlug: 'clube-azul', tenantName: 'Clube Azul', roles: ['OWNER'] }]);
    render(rotas());
    expect(screen.getByRole('heading', { name: 'Você já é criador' })).toBeInTheDocument();
    expect(screen.getByText('Clube Azul')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar outra comunidade' })).toBeInTheDocument();
  });
});

describe('helpers', () => {
  it('slugFromName tira acento, simbolos e hifens nas pontas', () => {
    expect(slugFromName('  Rifas do João & Cia!! ')).toBe('rifas-do-joao-cia');
    expect(slugFromName('Ação Ñandú')).toBe('acao-nandu');
  });

  it('safeNext so aceita caminho interno (sem redirecionamento aberto)', () => {
    expect(safeNext('/quero-criar-rifas')).toBe('/quero-criar-rifas');
    expect(safeNext('//evil.com')).toBeNull();
    expect(safeNext('https://evil.com')).toBeNull();
    expect(safeNext('/\\evil.com')).toBeNull();
    expect(safeNext('javascript:alert(1)')).toBeNull();
    expect(safeNext(null, '/conta')).toBe('/conta');
  });
});
