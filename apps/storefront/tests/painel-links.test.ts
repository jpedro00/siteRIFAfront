import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllEnvs());

const membro = (slug: string, roles: string[]) => ({
  tenantId: `id-${slug}`,
  tenantSlug: slug,
  tenantName: slug.toUpperCase(),
  roles,
});

/** "Meu painel" sai da sessao (memberships OWNER) e da configuracao; nunca de um endereco fixo. */
describe('link para o painel do criador', () => {
  it('so OWNER e criador; uma comunidade abre direto, varias abrem o seletor do painel', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_ORGANIZER_BASE_URL', 'https://painel.exemplo/');
    const { comunidadesDoCriador, painelUrl, painelUrlDoCriador } = await import('../src/lib/painel.ts');

    const so = comunidadesDoCriador({ memberships: [membro('a', ['OWNER']), membro('b', ['FINANCE'])] } as never);
    expect(so.map((m) => m.tenantSlug)).toEqual(['a']);
    expect(painelUrlDoCriador(so)).toBe('https://painel.exemplo/?comunidade=a');

    const duas = comunidadesDoCriador({ memberships: [membro('a', ['OWNER']), membro('b', ['OWNER'])] } as never);
    // nunca escolhe uma comunidade arbitraria: o seletor do painel decide
    expect(painelUrlDoCriador(duas)).toBe('https://painel.exemplo/');

    expect(comunidadesDoCriador({ memberships: [membro('c', ['SUPPORT'])] } as never)).toEqual([]);
    expect(painelUrlDoCriador([])).toBeNull();
    expect(painelUrl('com espaco')).toBe('https://painel.exemplo/?comunidade=com%20espaco');
    expect(comunidadesDoCriador(null)).toEqual([]);
  });

  it('sem VITE_ORGANIZER_BASE_URL nao existe link (nunca um link quebrado)', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_ORGANIZER_BASE_URL', '');
    const { painelUrl, painelUrlDoCriador } = await import('../src/lib/painel.ts');
    expect(painelUrl('a')).toBeNull();
    expect(painelUrlDoCriador([membro('a', ['OWNER'])] as never)).toBeNull();
  });
});
