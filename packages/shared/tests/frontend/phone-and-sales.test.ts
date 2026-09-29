import { describe, expect, it } from 'vitest';
import { checkPhone, formatPhoneInput, formatTimeUntil, remainingToSell, urgencyFor } from '../../src/frontend/index.js';

describe('formatPhoneInput · mascara com DDI', () => {
  it('Brasil, sem "+": (DD) NNNNN-NNNN, sem passar de 11 digitos', () => {
    expect(formatPhoneInput('')).toBe('');
    expect(formatPhoneInput('1')).toBe('(1');
    expect(formatPhoneInput('11')).toBe('(11');
    expect(formatPhoneInput('119')).toBe('(11) 9');
    expect(formatPhoneInput('1198888')).toBe('(11) 9888-8');
    expect(formatPhoneInput('11988887777')).toBe('(11) 98888-7777');
    expect(formatPhoneInput('119888877779999')).toBe('(11) 98888-7777');
  });

  it('colar numero ja formatado nao briga com quem digitou', () => {
    expect(formatPhoneInput('(11) 98888-7777')).toBe('(11) 98888-7777');
  });

  it('+55 mantem a mascara brasileira depois do DDI', () => {
    expect(formatPhoneInput('+')).toBe('+');
    expect(formatPhoneInput('+55')).toBe('+55');
    expect(formatPhoneInput('+5511988887777')).toBe('+55 (11) 98888-7777');
  });

  it('outro pais: DDI + blocos de 3', () => {
    expect(formatPhoneInput('+351912345678')).toBe('+351 912 345 678');
    expect(formatPhoneInput('+14155550123')).toBe('+1 415 555 012 3');
  });
});

describe('checkPhone · valida e normaliza para E.164', () => {
  it('celular e fixo do Brasil', () => {
    expect(checkPhone('(11) 98888-7777')).toMatchObject({ valid: true, e164: '+5511988887777' });
    expect(checkPhone('(11) 3888-7777')).toMatchObject({ valid: true, e164: '+551138887777' });
  });

  it('com +55 ou 55 na frente da o mesmo numero', () => {
    expect(checkPhone('+55 (11) 98888-7777').e164).toBe('+5511988887777');
    expect(checkPhone('5511988887777').e164).toBe('+5511988887777');
  });

  it('recusa curto, DDD invalido e celular sem o 9', () => {
    expect(checkPhone('9888').valid).toBe(false);
    expect(checkPhone('(05) 98888-7777').message).toContain('DDD');
    expect(checkPhone('(11) 88888-7777').valid).toBe(false);
  });

  it('internacional: 8 a 15 digitos, guardado como E.164', () => {
    expect(checkPhone('+351 912 345 678')).toMatchObject({ valid: true, e164: '+351912345678' });
    expect(checkPhone('+351 12').valid).toBe(false);
    expect(checkPhone('+1234567890123456').valid).toBe(false);
  });
});

describe('faltam X (RN18) e urgencia', () => {
  it('total - pagos, nunca negativo', () => {
    expect(remainingToSell(100, 70)).toBe(30);
    expect(remainingToSell(100, 100)).toBe(0);
    expect(remainingToSell(100, 130)).toBe(0);
  });

  it('limiares 25 e 10: none -> low -> critical -> soldout', () => {
    expect(urgencyFor(60)).toBe('none');
    expect(urgencyFor(25)).toBe('low');
    expect(urgencyFor(11)).toBe('low');
    expect(urgencyFor(10)).toBe('critical');
    expect(urgencyFor(1)).toBe('critical');
    expect(urgencyFor(0)).toBe('soldout');
  });

  it('respeita limiares proprios do sorteio', () => {
    expect(urgencyFor(40, [50, 20, 5])).toBe('none');
    expect(urgencyFor(5, [50, 20, 5])).toBe('critical');
  });
});

describe('formatTimeUntil', () => {
  const agora = Date.parse('2030-01-01T12:00:00Z');
  const em = (ms: number) => new Date(agora + ms).toISOString();

  it('dias, horas e minutos', () => {
    expect(formatTimeUntil(em(3 * 86_400_000 + 4 * 3_600_000), agora)).toBe('em 3 dias e 4 h');
    expect(formatTimeUntil(em(1 * 86_400_000), agora)).toBe('em 1 dia');
    expect(formatTimeUntil(em(2 * 3_600_000 + 15 * 60_000), agora)).toBe('em 2 h 15 min');
    expect(formatTimeUntil(em(12 * 60_000), agora)).toBe('em 12 min');
    expect(formatTimeUntil(em(20_000), agora)).toBe('agora');
  });

  it('data passada, ausente ou invalida: null (o contador some)', () => {
    expect(formatTimeUntil(em(-1000), agora)).toBeNull();
    expect(formatTimeUntil(null, agora)).toBeNull();
    expect(formatTimeUntil('nao-e-data', agora)).toBeNull();
  });
});
