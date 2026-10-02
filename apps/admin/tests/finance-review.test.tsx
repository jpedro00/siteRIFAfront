import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiClientError,
  type PlatformReconciliationResponse,
  type ReviewQueueItem,
} from '@clubedarifa/shared';

const h = vi.hoisted(() => ({ call: vi.fn(), can: true }));

vi.mock('../src/api.ts', () => ({ api: { call: h.call } }));
vi.mock('../src/state/SessionProvider.tsx', () => ({
  useSession: () => ({ can: () => h.can }),
}));

import { FinancePage } from '../src/pages/FinancePage.tsx';
import { ReviewQueuePage } from '../src/pages/ReviewQueuePage.tsx';

/**
 * Super Admin · Financeiro (conciliacao) e fila de revisao com o sorteio completo
 * (DOC-01 §17). As duas telas leem; so a revisao decide, e o backend confere a permissao.
 */

const resumo = (extra: Partial<PlatformReconciliationResponse> = {}): PlatformReconciliationResponse => ({
  generatedAt: '2026-10-01T12:00:00.000Z',
  openCount: 2,
  byKind: [
    { kind: 'MANUAL_REFUND_OPEN', count: 1 },
    { kind: 'PAYMENT_AUTHORIZATION_UNAVAILABLE', count: 1 },
  ],
  issues: [
    {
      kind: 'MANUAL_REFUND_OPEN',
      tenantSlug: 'clube-a',
      tenantName: 'Clube A',
      reference: 'abcd1234',
      amountCents: 4500,
      paymentStatus: 'APROVADO',
      needsManualRefund: true,
      detectedAt: '2026-10-01T10:00:00.000Z',
    },
    {
      kind: 'PAYMENT_AUTHORIZATION_UNAVAILABLE',
      tenantSlug: 'clube-b',
      tenantName: 'Clube B',
      reference: 'efgh5678',
      amountCents: 1500,
      paymentStatus: 'PENDENTE',
      needsManualRefund: false,
      detectedAt: '2026-10-01T09:00:00.000Z',
    },
  ],
  ...extra,
});

beforeEach(() => {
  h.call.mockReset();
  h.can = true;
});

describe('Console · Financeiro (conciliacao)', () => {
  it('lista as divergencias abertas com tipo em texto, comunidade, referencia curta e valor', async () => {
    h.call.mockResolvedValue(resumo());
    render(<FinancePage />);
    const tabela = await screen.findByRole('table');
    expect(h.call).toHaveBeenCalledWith('platformReconciliation');

    const linhas = within(tabela).getAllByRole('row').slice(1);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toHaveTextContent('Devolução manual em aberto');
    expect(linhas[0]).toHaveTextContent('Clube A');
    expect(linhas[0]).toHaveTextContent('abcd1234');
    expect(linhas[0]).toHaveTextContent('R$ 45,00');
    expect(linhas[1]).toHaveTextContent('Conta de recebimento indisponível');
    // resumo por tipo, em TEXTO (nao so cor)
    expect(screen.getByRole('list', { name: 'Divergências por tipo' })).toHaveTextContent('Devolução manual em aberto: 1');
  });

  it('nenhuma divergencia: estado vazio positivo, sem tabela', async () => {
    h.call.mockResolvedValue(resumo({ openCount: 0, byKind: [], issues: [] }));
    render(<FinancePage />);
    expect(await screen.findByText('Nenhuma divergência aberta')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('mais do que a lista mostra: diz quantas existem', async () => {
    h.call.mockResolvedValue(resumo({ openCount: 340 }));
    render(<FinancePage />);
    expect(await screen.findByText(/Mostrando as 2 mais recentes de 340/)).toBeInTheDocument();
  });

  it('erro: mostra o erro com a opcao de tentar de novo', async () => {
    h.call.mockRejectedValueOnce(new ApiClientError({ code: 'INTERNAL', message: 'Erro interno.', status: 500 }));
    h.call.mockResolvedValueOnce(resumo());
    render(<FinancePage />);
    const tentar = await screen.findByRole('button', { name: /tentar/i });
    fireEvent.click(tentar);
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('nao e uma tela de acao: nenhum botao alem de Atualizar', async () => {
    h.call.mockResolvedValue(resumo());
    render(<FinancePage />);
    await screen.findByRole('table');
    expect(screen.getAllByRole('button').map((b) => b.textContent?.trim())).toEqual(['Atualizar']);
    expect(document.body.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });
});

// ---------------------------------------------------------------------------
const pedido = (extra: Partial<ReviewQueueItem> = {}): ReviewQueueItem => ({
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Rifa do Natal',
  prizeName: 'Moto 0 km',
  unitPriceCents: 1500,
  totalNumbers: 500,
  drawDate: '2030-01-10T20:00:00.000Z',
  createdAt: '2029-12-01T00:00:00.000Z',
  tenantId: '22222222-2222-4222-8222-222222222222',
  tenantSlug: 'clube-a',
  tenantName: 'Clube A',
  subtitle: 'Concorra a uma moto zero',
  category: 'Veículos',
  description: 'Sorteio beneficente.',
  regulation: 'REGULAMENTO COMPLETO DO SORTEIO: participam todos os números pagos.',
  prizes: [
    { position: 1, name: 'Moto 0 km', description: 'Zero km', imageUrl: 'https://cdn.exemplo/moto.jpg', estimatedValueCents: 2_500_000 },
    { position: 2, name: 'Capacete', description: null, imageUrl: null, estimatedValueCents: null },
  ],
  salesStartAt: null,
  closeMode: 'POR_DATA',
  closeAt: '2030-01-09T20:00:00.000Z',
  noWinnerPolicy: 'PROXIMO_VENDIDO_ACIMA',
  thresholds: [25, 10],
  customization: { progressMode: 'PERCENTUAL', headline: 'Corra!', ctaLabel: null },
  submittedAt: '2029-12-02T10:00:00.000Z',
  ...extra,
});

describe('Console · fila de revisao com o sorteio completo', () => {
  const abrir = () =>
    render(
      <MemoryRouter>
        <ReviewQueuePage />
      </MemoryRouter>,
    );

  it('o revisor ve regulamento, premios com valor, cronograma e personalizacao sem sair da fila', async () => {
    h.call.mockResolvedValue({ draws: [pedido()], nextCursor: null });
    abrir();
    const detalhe = (await screen.findByText('Ver o sorteio completo antes de decidir')).closest('details')!;
    fireEvent.click(within(detalhe).getByText('Ver o sorteio completo antes de decidir'));

    expect(detalhe).toHaveTextContent('Concorra a uma moto zero');
    expect(detalhe).toHaveTextContent('Veículos');
    expect(detalhe).toHaveTextContent('REGULAMENTO COMPLETO DO SORTEIO');
    expect(detalhe).toHaveTextContent('Moto 0 km');
    expect(detalhe).toHaveTextContent('valor estimado R$ 25.000,00');
    expect(detalhe).toHaveTextContent('https://cdn.exemplo/moto.jpg');
    expect(detalhe).toHaveTextContent('Sem foto'); // o capacete
    expect(detalhe).toHaveTextContent('em data fixa');
    expect(detalhe).toHaveTextContent('Avisos de “faltam X”: 25, 10');
    expect(detalhe).toHaveTextContent('% vendido');
    expect(detalhe).toHaveTextContent('“Corra!”');
  });

  it('sorteio sem regulamento proprio e sinalizado ao revisor', async () => {
    h.call.mockResolvedValue({ draws: [pedido({ regulation: null })], nextCursor: null });
    abrir();
    expect(await screen.findByText('Este sorteio não tem regulamento próprio.')).toBeInTheDocument();
  });

  it('aprovar e reprovar continuam como antes (reprovar exige motivo)', async () => {
    h.call.mockResolvedValue({ draws: [pedido()], nextCursor: null });
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Reprovar' }));
    const enviar = screen.getByRole('button', { name: 'Devolver ao organizador' });
    expect(enviar).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Motivo da reprovação/), { target: { value: 'Faltou o CNPJ no regulamento.' } });
    h.call.mockResolvedValue({});
    fireEvent.click(enviar);
    await vi.waitFor(() =>
      expect(h.call).toHaveBeenCalledWith(
        'platformReviewDecide',
        { to: 'RASCUNHO', reason: 'Faltou o CNPJ no regulamento.' },
        { params: { id: '11111111-1111-4111-8111-111111111111' } },
      ),
    );
  });
});
