import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@clubedarifa/shared';

const h = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock('../src/api.ts', () => ({
  api: { call: h.call, setMarketplaceTenant: vi.fn(), marketplaceTenant: null },
  apiBaseUrl: 'https://api.test',
}));

import { AccountPage } from '../src/pages/AccountPage.tsx';
import { StorefrontProvider } from '../src/state/SessionProvider.tsx';

/**
 * A API aceita a senha (200) mas o navegador descarta o cookie de sessao (cookie de terceiros
 * bloqueado). Sem aviso, a pessoa so veria a tela de login de novo.
 */
const naoAutenticado = () => new ApiClientError({ code: 'UNAUTHENTICATED', message: 'Sessão ausente.', status: 401 });

function montar() {
  return render(
    <MemoryRouter>
      <StorefrontProvider>
        <AccountPage />
      </StorefrontProvider>
    </MemoryRouter>,
  );
}

async function entrar() {
  fireEvent.change(await screen.findByLabelText('E-mail'), { target: { value: 'pessoa@exemplo.com' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'Senha-Correta-2026' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

beforeEach(() => h.call.mockReset());

describe('login quando o navegador bloqueia o cookie', () => {
  it('senha certa + sessao inexistente logo depois = aviso claro de cookie bloqueado', async () => {
    h.call.mockImplementation(async (name: string) => {
      if (name === 'publicTenantBranding') return { tenantId: 't', slug: 's', name: 'Clube', publicName: null, logoLightUrl: null, logoDarkUrl: null, faviconUrl: null, colors: {}, fonts: {}, contact: {}, description: null, footerText: null, bannerUrl: null, pages: {} };
      if (name === 'session') throw naoAutenticado();
      if (name === 'login') return { status: 'authenticated', user: { id: 'u', email: 'pessoa@exemplo.com', displayName: 'Pessoa' } };
      return {};
    });
    montar();
    await entrar();
    expect(await screen.findByText(/o navegador bloqueou o cookie de sessão/)).toBeInTheDocument();
  });

  it('login normal (sessao existe) nao mostra o aviso', async () => {
    let logou = false;
    h.call.mockImplementation(async (name: string) => {
      if (name === 'publicTenantBranding') return { tenantId: 't', slug: 's', name: 'Clube', publicName: null, logoLightUrl: null, logoDarkUrl: null, faviconUrl: null, colors: {}, fonts: {}, contact: {}, description: null, footerText: null, bannerUrl: null, pages: {} };
      if (name === 'login') {
        logou = true;
        return { status: 'authenticated', user: { id: 'u', email: 'pessoa@exemplo.com', displayName: 'Pessoa' } };
      }
      if (name === 'session') {
        if (!logou) throw naoAutenticado();
        return { user: { id: 'u', email: 'pessoa@exemplo.com', displayName: 'Pessoa' }, memberships: [], mfaRequired: false, mfaSatisfied: true, mfaEnrolled: false };
      }
      if (name === 'accountOrders') return { orders: [], nextCursor: null };
      return {};
    });
    montar();
    await entrar();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Minha conta' })).toBeInTheDocument());
    expect(screen.queryByText(/bloqueou o cookie/)).toBeNull();
  });
});
