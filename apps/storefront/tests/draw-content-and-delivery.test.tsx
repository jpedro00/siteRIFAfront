import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicDrawDetail, PublicDrawResult } from '@clubedarifa/shared';

const h = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock('../src/api.ts', () => ({ api: { call: h.call } }));

import { DrawStats } from '../src/components/DrawStats.tsx';
import { ResultPage } from '../src/pages/ResultPage.tsx';

/**
 * Vitrine: a personalizacao do sorteio e honrada (progresso oculto) e a pagina do resultado
 * mostra o status publico da entrega (DOC-01 §6 e §15) sem rastreio, observacao nem foto.
 */

const sorteio = (extra: Partial<PublicDrawDetail> = {}): PublicDrawDetail =>
  ({
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'rifa-1',
    title: 'Rifa do Natal',
    subtitle: null,
    description: null,
    prizeName: 'Moto',
    prizeImageUrl: null,
    unitPriceCents: 1500,
    ticketPriceCents: 1500,
    promotionalPriceCents: null,
    promoUntil: null,
    promoActive: false,
    totalNumbers: 100,
    labelDigits: 2,
    status: 'ATIVA',
    drawDate: '2030-01-10T20:00:00.000Z',
    paidCount: 40,
    prizeDescription: null,
    category: null,
    regulation: null,
    customization: { progressMode: 'FALTAM', headline: null, ctaLabel: null },
    prizes: [],
    closeMode: 'AO_ESGOTAR',
    closeAt: null,
    salesStartAt: null,
    resultSource: 'LOTERIA_FEDERAL',
    noWinnerPolicy: 'PROXIMO_VENDIDO_ACIMA',
    takenCount: 45,
    ...extra,
  }) as PublicDrawDetail;

describe('personalizacao honrada pela vitrine', () => {
  it('padrao: mostra numeros vendidos', () => {
    render(<DrawStats draw={sorteio()} />);
    expect(screen.getByText('Números vendidos')).toBeInTheDocument();
  });

  it('progresso OCULTAR: o total vendido tambem some (so o que nao revela o progresso fica)', () => {
    render(<DrawStats draw={sorteio({ customization: { progressMode: 'OCULTAR', headline: null, ctaLabel: null } })} />);
    expect(screen.queryByText('Números vendidos')).toBeNull();
    expect(screen.getByText('Valor por número')).toBeInTheDocument();
    expect(screen.getByText('Números disponíveis')).toBeInTheDocument();
  });
});

const resultado = (extra: Partial<PublicDrawResult> = {}): PublicDrawResult =>
  ({
    drawTitle: 'Rifa do Natal',
    drawSlug: 'rifa-1',
    labelDigits: 2,
    drawDate: '2030-01-10T20:00:00.000Z',
    current: {
      version: 1,
      status: 'VIGENTE',
      source: 'LOTERIA_FEDERAL',
      federalNumber: '12342',
      federalContest: '6001',
      candidateNumber: 42,
      winningNumber: 42,
      winningLabel: '42',
      winnerMasked: 'M*** S***',
      attempts: [],
      evidenceText: 'Registro.',
      evidenceUrl: null,
      snapshotSha256: 'a'.repeat(64),
      proofSha256: 'b'.repeat(64),
      correctionReason: null,
      publishedAt: '2030-01-10T21:00:00.000Z',
    },
    previous: [],
    delivery: null,
    ...extra,
  }) as PublicDrawResult;

function abrir() {
  return render(
    <MemoryRouter initialEntries={['/sorteio/rifa-1/resultado']}>
      <Routes>
        <Route path="/sorteio/:slug/resultado" element={<ResultPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => h.call.mockReset());

describe('resultado publico · entrega do premio', () => {
  it('sem entrega registrada: diz que ainda nao foi registrada', async () => {
    h.call.mockResolvedValue(resultado());
    abrir();
    expect(await screen.findByText('A entrega do prêmio ainda não foi registrada pela organização.')).toBeInTheDocument();
  });

  it('com entrega: "Prêmio entregue em DD/MM/AAAA" e a forma, e nada alem disso', async () => {
    h.call.mockResolvedValue(resultado({ delivery: { method: 'ENVIO', deliveredAt: '2030-03-01T15:00:00.000Z' } }));
    const { container } = abrir();
    expect(await screen.findByText(/Prêmio entregue em 01\/03\/2030/)).toBeInTheDocument();
    expect(container).toHaveTextContent('enviado ao ganhador');
    expect(container.textContent).not.toMatch(/rastreio|BR123|foto do ganhador|autoriza/i);
  });
});
