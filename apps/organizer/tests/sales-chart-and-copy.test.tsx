import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CopyLink } from '../src/components/CopyLink.tsx';
import { SalesChart } from '../src/components/SalesChart.tsx';

describe('SalesChart', () => {
  it('descreve o total em texto e oferece a tabela', () => {
    render(
      <SalesChart
        days={[
          { date: '2026-09-01', paidNumbers: 3, revenueCents: 4500 },
          { date: '2026-09-02', paidNumbers: 0, revenueCents: 0 },
        ]}
      />,
    );
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('3 no total');
    expect(screen.getByText('Ver em tabela')).toBeTruthy();
  });

  it('sem vendas diz isso', () => {
    render(<SalesChart days={[{ date: '2026-09-01', paidNumbers: 0, revenueCents: null }]} />);
    expect(screen.getByText(/Nenhuma venda paga/)).toBeTruthy();
  });
});

describe('CopyLink', () => {
  it('copia o link e confirma', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<CopyLink value="https://x.test/convite/abc" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    expect(writeText).toHaveBeenCalledWith('https://x.test/convite/abc');
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeTruthy();
  });
});
