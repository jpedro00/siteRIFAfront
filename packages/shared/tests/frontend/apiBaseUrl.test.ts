import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl } from '../../src/frontend/apiBaseUrl.js';

describe('resolveApiBaseUrl', () => {
  it('usa localhost apenas em desenvolvimento quando nao ha valor configurado', () => {
    expect(resolveApiBaseUrl(undefined, { production: false })).toBe('http://localhost:3000');
  });

  it('normaliza barra final da URL configurada', () => {
    expect(resolveApiBaseUrl('https://api.example.com/', { production: true })).toBe(
      'https://api.example.com',
    );
  });

  it('recusa ausencia de VITE_API_BASE_URL em producao', () => {
    expect(() => resolveApiBaseUrl(undefined, { production: true })).toThrow(/VITE_API_BASE_URL/);
  });

  it('recusa localhost em producao', () => {
    expect(() => resolveApiBaseUrl('http://localhost:3000', { production: true })).toThrow(
      /localhost\/loopback/,
    );
  });
});
