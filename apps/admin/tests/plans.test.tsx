import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, type PlatformPlan } from '@clubedarifa/shared';

const h = vi.hoisted(() => ({ call: vi.fn(), permissions: new Set<string>() }));

vi.mock('../src/api.ts', () => ({ api: { call: h.call } }));
vi.mock('../src/state/SessionProvider.tsx', () => ({
  useSession: () => ({ can: (p: string) => h.permissions.has(p) }),
}));

import { PlansPage } from '../src/pages/PlansPage.tsx';

/** Catalogo de planos no Console: o servidor cria Product e Price; a tela nunca envia ID da Stripe. */

const plano = (extra: Partial<PlatformPlan> = {}): PlatformPlan => ({
  id: '44444444-4444-4444-8444-444444444444',
  code: 'basico-mensal',
  name: 'Básico',
  description: 'Plano de entrada',
  interval: 'month',
  priceCents: 4990,
  currency: 'brl',
  maxActiveDraws: 5,
  maxTeamMembers: null,
  features: [],
  status: 'AVAILABLE',
  stripeProductId: 'prod_abc123',
  stripePriceId: 'price_abc123',
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
  ...extra,
});

function catalogo(lista: PlatformPlan[], extra: Record<string, unknown> = {}) {
  h.call.mockImplementation(async (name: string) => {
    if (name === 'platformPlans') return { plans: lista };
    if (name in extra) {
      const v = extra[name];
      if (v instanceof Error) throw v;
      return v;
    }
    throw new Error(`chamada inesperada: ${name}`);
  });
}

const abrir = () =>
  render(
    <MemoryRouter>
      <PlansPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  h.call.mockReset();
  h.permissions = new Set(['platform:billing:read', 'platform:billing:manage']);
});

describe('Console · Planos', () => {
  it('lista o catalogo com codigo, status, preco, limites (ilimitado sem inventar numero) e IDs da Stripe', async () => {
    catalogo([plano()]);
    abrir();
    expect(await screen.findByText('Básico')).toBeInTheDocument();
    expect(screen.getByText('basico-mensal')).toBeInTheDocument();
    expect(screen.getByText('À venda')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*49,90 \/ mês/)).toBeInTheDocument();
    expect(screen.getByText('Sorteios: 5')).toBeInTheDocument();
    expect(screen.getByText('Equipe: Ilimitado')).toBeInTheDocument();
    expect(screen.getByText('prod_abc123')).toBeInTheDocument();
    expect(screen.getByText('price_abc123')).toBeInTheDocument();
  });

  it('cria um plano: envia so os dados comerciais (nenhum ID da Stripe) e confirma', async () => {
    catalogo([], { platformCreatePlan: plano({ code: 'pro-anual', status: 'DRAFT' }) });
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: /Novo plano/ }));

    fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'pro-anual' } });
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Pro' } });
    fireEvent.change(screen.getByLabelText('Preço (R$)'), { target: { value: '499,90' } });
    fireEvent.change(screen.getByLabelText('Periodicidade'), { target: { value: 'year' } });
    fireEvent.change(screen.getByLabelText('Limite de sorteios ativos'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar plano' }));

    await waitFor(() => expect(h.call).toHaveBeenCalledWith('platformCreatePlan', expect.anything()));
    const corpo = h.call.mock.calls.find((c) => c[0] === 'platformCreatePlan')![1];
    expect(corpo).toEqual({
      code: 'pro-anual',
      name: 'Pro',
      interval: 'year',
      priceCents: 49990,
      currency: 'brl',
      maxActiveDraws: 20,
      maxTeamMembers: null,
      features: [],
    });
    expect(JSON.stringify(corpo)).not.toMatch(/stripe|prod_|price_/i);
    expect(await screen.findByText(/criado como rascunho e sincronizado com a Stripe/)).toBeInTheDocument();
  });

  it('valida no formulario antes de chamar a API', async () => {
    catalogo([]);
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: /Novo plano/ }));
    fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'x' } });
    fireEvent.change(screen.getByLabelText('Preço (R$)'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar plano' }));
    expect(await screen.findByText(/Use 3 a 40 letras minúsculas/)).toBeInTheDocument();
    expect(screen.getByText('Informe o nome do plano.')).toBeInTheDocument();
    expect(screen.getByText(/Informe um valor válido/)).toBeInTheDocument();
    expect(h.call.mock.calls.some((c) => c[0] === 'platformCreatePlan')).toBe(false);
  });

  it('codigo duplicado (409): mostra a mensagem do servidor no formulario', async () => {
    catalogo([], { platformCreatePlan: new ApiClientError({ code: 'CONFLICT', message: 'Já existe um plano com este código.', status: 409 }) });
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: /Novo plano/ }));
    fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'basico-mensal' } });
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Básico' } });
    fireEvent.change(screen.getByLabelText('Preço (R$)'), { target: { value: '49,90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar plano' }));
    expect(await screen.findByText('Já existe um plano com este código.')).toBeInTheDocument();
  });

  it('erro da Stripe ao criar: avisa que o rascunho foi salvo e a lista mostra "sincronizacao pendente" com como retomar', async () => {
    let criado = false;
    h.call.mockImplementation(async (name: string) => {
      if (name === 'platformPlans') {
        return { plans: criado ? [plano({ code: 'novo-plano', status: 'DRAFT', stripeProductId: 'prod_x', stripePriceId: null })] : [] };
      }
      if (name === 'platformCreatePlan') {
        if (!criado) {
          criado = true;
          throw new ApiClientError({ code: 'BILLING_UNAVAILABLE', message: 'A contratação de planos não está disponível agora.', status: 503 });
        }
        return plano({ code: 'novo-plano', status: 'DRAFT' });
      }
      throw new Error(`inesperada: ${name}`);
    });
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: /Novo plano/ }));
    fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'novo-plano' } });
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Novo' } });
    fireEvent.change(screen.getByLabelText('Preço (R$)'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar plano' }));

    expect(await screen.findByText(/A Stripe não respondeu ao criar o plano. O rascunho foi salvo/)).toBeInTheDocument();
    expect(await screen.findByText('Sincronização pendente')).toBeInTheDocument();
    // publicar ainda nao e oferecido: o plano nao existe na Stripe
    expect(screen.queryByRole('button', { name: /Publicar/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Concluir sincronização' }));
    await waitFor(() => expect(h.call.mock.calls.filter((c) => c[0] === 'platformCreatePlan').length).toBe(2));
    // retomar = repetir os MESMOS dados (o servidor reconhece e nao duplica)
    const retomada = h.call.mock.calls.filter((c) => c[0] === 'platformCreatePlan')[1]![1];
    expect(retomada).toMatchObject({ code: 'novo-plano', name: 'Básico', priceCents: 4990 });
    expect(await screen.findByText(/sincronizado com a Stripe/)).toBeInTheDocument();
  });

  it('plano ARQUIVADO: continua na lista, mostra o estado e oferece reativar (nao arquivar de novo)', async () => {
    catalogo([plano({ status: 'ARCHIVED' })]);
    abrir();
    expect(await screen.findByText('Arquivado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reativar o plano basico-mensal' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Arquivar o plano/ })).toBeNull();
    expect(screen.getByText('basico-mensal')).toBeInTheDocument();
  });

  it('arquivar pede confirmacao e explica que quem ja contratou continua com o plano', async () => {
    catalogo([plano()], { platformUpdatePlan: plano({ status: 'ARCHIVED' }) });
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Arquivar o plano basico-mensal' }));
    const painel = await screen.findByRole('alertdialog');
    expect(within(painel).getByText(/Quem já o contratou continua com ele/)).toBeInTheDocument();
    expect(h.call.mock.calls.some((c) => c[0] === 'platformUpdatePlan')).toBe(false);
    fireEvent.click(within(painel).getByRole('button', { name: 'Arquivar' }));
    await waitFor(() =>
      expect(h.call).toHaveBeenCalledWith('platformUpdatePlan', { status: 'ARCHIVED' }, { params: { id: '44444444-4444-4444-8444-444444444444' } }),
    );
  });

  it('publicar um rascunho envia so o status', async () => {
    catalogo([plano({ status: 'DRAFT' })], { platformUpdatePlan: plano({ status: 'AVAILABLE' }) });
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar o plano basico-mensal' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Publicar' }));
    await waitFor(() =>
      expect(h.call).toHaveBeenCalledWith('platformUpdatePlan', { status: 'AVAILABLE' }, { params: { id: '44444444-4444-4444-8444-444444444444' } }),
    );
  });

  it('sem permissao de gerir: ve o catalogo, mas nao ha botao de criar nem de alterar', async () => {
    h.permissions = new Set(['platform:billing:read']);
    catalogo([plano()]);
    abrir();
    await screen.findByText('Básico');
    expect(screen.queryByRole('button', { name: /Novo plano/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Arquivar|Publicar|Reativar/ })).toBeNull();
  });

  it('erro ao carregar: mostra o erro com "tentar de novo"', async () => {
    h.call.mockRejectedValue(new ApiClientError({ code: 'INTERNAL', message: 'Erro interno. Tente novamente em instantes.', status: 500 }));
    abrir();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
