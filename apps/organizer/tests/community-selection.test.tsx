import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  call: vi.fn(),
  setTenantSlug: vi.fn(),
  tenantSlug: null as string | null,
  store: vi.fn(),
}));
vi.mock('../src/api.ts', () => ({
  api: {
    call: h.call,
    setTenantSlug: h.setTenantSlug,
    get tenantSlug() {
      return h.tenantSlug;
    },
  },
  storeSelectedCommunity: h.store,
}));

import { CommunityPickerPage, NoCommunityPage } from '../src/pages/CommunityPickerPage.tsx';
import { SessionProvider, useSession } from '../src/state/SessionProvider.tsx';

/**
 * Organizer central: um dominio para todos os criadores. A comunidade e escolhida pelo criador,
 * mas SO vale se for um vinculo da SESSAO (o servidor confere de novo a cada requisicao).
 */
const vinculo = (slug: string, nome: string) => ({ tenantId: `id-${slug}`, tenantSlug: slug, tenantName: nome, roles: ['OWNER'] });
const sessao = (memberships: unknown[]) => ({
  user: { id: 'u1', email: 'a@b.com', displayName: 'Ana' },
  memberships,
  mfaRequired: false,
  mfaSatisfied: true,
  mfaEnrolled: true,
});

function Sonda() {
  const s = useSession();
  return (
    <div>
      <p data-testid="estado">
        {s.status}|{s.tenant?.slug ?? '-'}|{s.needsCommunity ? 'escolher' : '-'}|{s.noCommunity ? 'sem' : '-'}
      </p>
      <button type="button" onClick={() => s.selectCommunity('azul')}>
        escolher-azul
      </button>
      <button type="button" onClick={() => s.selectCommunity('invasora')}>
        escolher-invasora
      </button>
    </div>
  );
}

function montar(memberships: unknown[], slugInicial: string | null = null) {
  h.tenantSlug = slugInicial;
  h.call.mockImplementation(async (name: string) => {
    if (name === 'session') return sessao(memberships);
    if (name === 'tenantContext') {
      const slug = h.setTenantSlug.mock.calls.at(-1)?.[0] as string;
      return { tenantId: `id-${slug}`, slug, name: slug, roles: ['OWNER'], permissions: ['tenant:read'] };
    }
    return {};
  });
  return render(
    <MemoryRouter>
      <SessionProvider>
        <Sonda />
      </SessionProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.call.mockReset();
  h.setTenantSlug.mockReset();
  h.store.mockReset();
});

describe('escolha de comunidade no painel central', () => {
  it('um vinculo so: entra direto, sem pedir escolha', async () => {
    montar([vinculo('azul', 'Clube Azul')]);
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('authenticated|azul|-|-'));
  });

  it('varios vinculos e nenhuma escolha: pede para escolher e NAO carrega comunidade nenhuma', async () => {
    montar([vinculo('azul', 'Clube Azul'), vinculo('verde', 'Clube Verde')]);
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('authenticated|-|escolher|-'));
    expect(h.call).not.toHaveBeenCalledWith('tenantContext');
  });

  it('escolha guardada que NAO e vinculo da conta (slug herdado do navegador) e ignorada', async () => {
    montar([vinculo('azul', 'Clube Azul'), vinculo('verde', 'Clube Verde')], 'comunidade-alheia');
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('authenticated|-|escolher|-'));
  });

  it('escolha guardada que e vinculo da conta e usada', async () => {
    montar([vinculo('azul', 'Clube Azul'), vinculo('verde', 'Clube Verde')], 'verde');
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('authenticated|verde|-|-'));
  });

  it('sem vinculo nenhum: estado "sem comunidade", sem chamar o contexto', async () => {
    montar([]);
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('authenticated|-|-|sem'));
    expect(h.call).not.toHaveBeenCalledWith('tenantContext');
  });

  it('escolher guarda so o SLUG; escolher slug que nao e vinculo nao abre comunidade', async () => {
    montar([vinculo('azul', 'Clube Azul'), vinculo('verde', 'Clube Verde')]);
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('escolher'));

    act(() => screen.getByText('escolher-invasora').click());
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('authenticated|-|escolher|-'));

    act(() => screen.getByText('escolher-azul').click());
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('authenticated|azul|-|-'));
    expect(h.store).toHaveBeenCalledWith('azul');
  });
});

describe('telas de escolha', () => {
  it('lista as comunidades da sessao com o papel e escolhe pelo slug', async () => {
    h.call.mockImplementation(async () => sessao([vinculo('azul', 'Clube Azul'), vinculo('verde', 'Clube Verde')]));
    render(
      <MemoryRouter>
        <SessionProvider>
          <CommunityPickerPage />
        </SessionProvider>
      </MemoryRouter>,
    );
    const verde = await screen.findByRole('button', { name: /Clube Verde/ });
    expect(screen.getByRole('button', { name: /Clube Azul/ })).toBeInTheDocument();
    expect(verde).toHaveTextContent('Dono');
    act(() => verde.click());
    expect(h.store).toHaveBeenCalledWith('verde');
  });

  it('conta sem comunidade explica e nao oferece operar nada', () => {
    h.call.mockImplementation(async () => sessao([]));
    render(
      <MemoryRouter>
        <SessionProvider>
          <NoCommunityPage />
        </SessionProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Você ainda não tem uma comunidade' })).toBeInTheDocument();
  });
});
