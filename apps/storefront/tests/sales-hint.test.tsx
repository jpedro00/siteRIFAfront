import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SalesHint } from '../src/components/SalesHint.tsx';

describe('SalesHint', () => {
  it('mostra quantos faltam (total - pagos)', () => {
    render(<SalesHint total={100} paid={40} drawDate={null} />);
    expect(screen.getByText(/Faltam 60 números/)).toBeTruthy();
  });

  it('usa singular e sinaliza urgencia em texto, nao so em cor', () => {
    render(<SalesHint total={100} paid={99} drawDate={null} />);
    expect(screen.getByText(/Faltam 1 número$/)).toBeTruthy();
    expect(screen.getByText(/Últimos números/)).toBeTruthy();
  });

  it('esgotado', () => {
    render(<SalesHint total={100} paid={100} drawDate={null} />);
    expect(screen.getByText('Esgotado')).toBeTruthy();
  });
});
