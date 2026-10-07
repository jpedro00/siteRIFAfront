import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, MARKETPLACE_ALIASES, ROUTE_CONTRACTS } from '../src/index.js';

/**
 * Modo marketplace do cliente: as telas continuam chamando os nomes de sempre e o cliente troca
 * pela variante com a comunidade NO CAMINHO. Nunca por cabecalho.
 */
function stubFetch() {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function chamada(fetchMock: ReturnType<typeof stubFetch>) {
  const [url, init] = fetchMock.mock.calls.at(-1) as unknown as [string, { headers?: Record<string, string>; method?: string }];
  return { url, headers: (init.headers ?? {}) as Record<string, string>, method: init.method };
}

afterEach(() => vi.unstubAllGlobals());

describe('cliente da API em modo marketplace', () => {
  it('sem escopo, usa a rota da vitrine por comunidade (com cabecalho de dev)', async () => {
    const f = stubFetch();
    const api = new ApiClient({ baseUrl: 'https://api.test', tenantSlug: 'dev-local' });
    await api.call('publicDraw', undefined, { params: { slug: 'rifa-1' } });
    const c = chamada(f);
    expect(c.url).toBe('https://api.test/api/public/draws/rifa-1');
    expect(c.headers['x-tenant-slug']).toBe('dev-local');
  });

  it('com escopo, troca pela variante com a comunidade no caminho e NAO manda cabecalho de comunidade', async () => {
    const f = stubFetch();
    const api = new ApiClient({ baseUrl: 'https://api.test', tenantSlug: 'dev-local' });
    api.setMarketplaceTenant('clube-azul');
    await api.call('publicDraw', undefined, { params: { slug: 'rifa-1' } });
    const c = chamada(f);
    expect(c.url).toBe('https://api.test/api/public/marketplace/t/clube-azul/draws/rifa-1');
    expect(c.headers['x-tenant-slug']).toBeUndefined();
  });

  it('cobre toda a jornada de compra (grade, reserva, pedido, PIX, resultado)', async () => {
    const f = stubFetch();
    const api = new ApiClient({ baseUrl: 'https://api.test' });
    api.setMarketplaceTenant('clube-azul');
    await api.call('publicDrawNumbers', undefined, { params: { id: 'd1' } });
    expect(chamada(f).url).toContain('/api/public/marketplace/t/clube-azul/draws/d1/numbers');
    await api.call('createReservation', { numbers: [1, 2] }, { params: { id: 'd1' } });
    expect(chamada(f).method).toBe('POST');
    expect(chamada(f).url).toContain('/api/public/marketplace/t/clube-azul/draws/d1/reservations');
    await api.call('publicOrder', undefined, { params: { id: 'o1' } });
    expect(chamada(f).url).toContain('/api/public/marketplace/t/clube-azul/orders/o1');
    await api.call('publicOrderPayment', undefined, { params: { id: 'o1' } });
    expect(chamada(f).url).toContain('/api/public/marketplace/t/clube-azul/orders/o1/payment');
    await api.call('publicDrawResult', undefined, { params: { slug: 'rifa-1' } });
    expect(chamada(f).url).toContain('/marketplace/t/clube-azul/draws/rifa-1/result');
  });

  it('rotas que nao sao da vitrine (sessao, conta) nao mudam', async () => {
    const f = stubFetch();
    const api = new ApiClient({ baseUrl: 'https://api.test' });
    api.setMarketplaceTenant('clube-azul');
    await api.call('session');
    expect(chamada(f).url).toBe('https://api.test/api/auth/session');
    await api.call('accountOrders');
    expect(chamada(f).url).toBe('https://api.test/api/account/orders');
  });

  it('o slug do escopo vai codificado no caminho (nao escapa do segmento)', async () => {
    const f = stubFetch();
    const api = new ApiClient({ baseUrl: 'https://api.test' });
    api.setMarketplaceTenant('a/../b');
    await api.call('publicDraw', undefined, { params: { slug: 'x' } });
    expect(chamada(f).url).toContain('/marketplace/t/a%2F..%2Fb/draws/x');
  });

  it('sair do escopo volta ao normal', async () => {
    const f = stubFetch();
    const api = new ApiClient({ baseUrl: 'https://api.test' });
    api.setMarketplaceTenant('clube-azul');
    api.setMarketplaceTenant(null);
    await api.call('publicDraw', undefined, { params: { slug: 'x' } });
    expect(chamada(f).url).toBe('https://api.test/api/public/draws/x');
  });

  it('todo alias existe no registro, mantem o metodo e e publico com a comunidade no caminho', () => {
    for (const [original, alias] of Object.entries(MARKETPLACE_ALIASES)) {
      const o = ROUTE_CONTRACTS[original as keyof typeof ROUTE_CONTRACTS];
      const a = ROUTE_CONTRACTS[alias as keyof typeof ROUTE_CONTRACTS];
      expect(a, alias).toBeDefined();
      expect(a.method).toBe(o.method);
      expect(a.auth).toBe(false);
      expect(a.tenantScope).toBe('path');
      expect(a.path).toContain('/:tenantSlug');
    }
  });
});
