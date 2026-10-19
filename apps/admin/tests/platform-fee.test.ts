import { describe, expect, it } from 'vitest';
import { describePlatformFee, formatBpsAsPercent, parsePercentToBps } from '../src/lib/platformFee.ts';

describe('parsePercentToBps', () => {
  it.each([
    ['5', 500],
    ['0,5', 50],
    ['0.5', 50],
    ['12.34', 1234],
    ['12,34', 1234],
    ['0', 0],
    ['100', 10000],
    ['  7 ', 700],
  ])('%s -> %i bps', (entrada, bps) => {
    expect(parsePercentToBps(entrada)).toEqual({ ok: true, bps });
  });

  it('vazio = sem override (null)', () => {
    expect(parsePercentToBps('')).toEqual({ ok: true, bps: null });
    expect(parsePercentToBps('   ')).toEqual({ ok: true, bps: null });
  });

  it.each(['100.01', '-1', 'abc', '5%', '1,234', '1e2', '5,'])('%s -> erro', (entrada) => {
    expect(parsePercentToBps(entrada).ok).toBe(false);
  });
});

describe('exibicao', () => {
  it('bps -> porcentagem em pt-BR', () => {
    expect(formatBpsAsPercent(500)).toBe('5');
    expect(formatBpsAsPercent(50)).toBe('0,5');
    expect(formatBpsAsPercent(1234)).toBe('12,34');
    expect(formatBpsAsPercent(null)).toBe('');
  });

  it('null aparece como padrao da plataforma', () => {
    expect(describePlatformFee(null)).toBe('Padrão da plataforma');
    expect(describePlatformFee(undefined)).toBe('Padrão da plataforma');
    expect(describePlatformFee(0)).toBe('0%');
    expect(describePlatformFee(1234)).toBe('12,34%');
  });
});
