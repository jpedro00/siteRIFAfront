import { describe, expect, it } from 'vitest';
import { shortOrderReference } from '../../src/frontend/orderReference.js';
import {
  accountOrdersResponseSchema,
  registerRequestSchema,
} from '../../src/contracts/routes.js';

describe('referencia curta do pedido', () => {
  it('deriva seis hexadecimais maiusculos do fim do identificador', () => {
    expect(shortOrderReference('9eba7453-1be0-4ba5-8a17-7c64c31a210f')).toBe('1A210F');
    expect(shortOrderReference('6c111287-fcfe-412b-b286-258f8fd4d7a8')).toBe('D4D7A8');
  });

  it('e estavel: o mesmo pedido devolve sempre a mesma referencia', () => {
    const id = 'af018f4b-942d-4c61-9985-7e8f12b819ed';
    expect(shortOrderReference(id)).toBe(shortOrderReference(id));
  });

  /**
   * A referencia DERIVA do identificador — e esse o desenho. O que ela nao
   * pode e servir de identificador: seis digitos nao reconstroem os trinta e
   * dois, entao quem le o comprovante nao consegue montar a URL de outro
   * pedido a partir dele.
   */
  it('e curta demais para reconstruir o identificador tecnico', () => {
    const id = 'af018f4b-942d-4c61-9985-7e8f12b819ed';
    const curta = shortOrderReference(id);
    expect(curta).toHaveLength(6);
    expect(curta).toMatch(/^[0-9A-F]{6}$/);
    expect(id.replace(/-/g, '')).toHaveLength(32);
  });
});

describe('contrato de cadastro', () => {
  const valido = {
    displayName: 'Participante',
    email: 'pessoa@example.com',
    password: 'Senha-Muito-Boa-2026!',
    passwordConfirmation: 'Senha-Muito-Boa-2026!',
  };

  it('normaliza e-mail: espacos e maiusculas nao criam identidade nova', () => {
    const r = registerRequestSchema.parse({ ...valido, email: '  PESSOA@Example.COM  ' });
    expect(r.email).toBe('pessoa@example.com');
  });

  it('recusa confirmacao divergente, apontando o campo', () => {
    const r = registerRequestSchema.safeParse({
      ...valido,
      passwordConfirmation: 'Outra-Senha-2026!',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(['passwordConfirmation']);
    }
  });

  it('recusa senha curta demais', () => {
    const r = registerRequestSchema.safeParse({
      ...valido,
      password: 'curta',
      passwordConfirmation: 'curta',
    });
    expect(r.success).toBe(false);
  });
});

describe('contrato de pedidos da conta', () => {
  const pedido = {
    orderId: 'af018f4b-942d-4c61-9985-7e8f12b819ed',
    status: 'PENDENTE' as const,
    quantity: 2,
    unitPriceCents: 1500,
    totalCents: 3000,
    createdAt: '2026-09-24T12:00:00.000Z',
    paidAt: null,
    numbers: [7, 13],
    labelDigits: 3 as const,
    drawSlug: 'moto-0km',
    drawTitle: 'Moto 0km',
    tenantSlug: 'comunidade',
    tenantName: 'Comunidade',
  };

  it('aceita a pagina com cursor e a ultima pagina sem ele', () => {
    expect(
      accountOrdersResponseSchema.parse({ orders: [pedido], nextCursor: '2026-09-24|abc' })
        .nextCursor,
    ).toBe('2026-09-24|abc');
    expect(accountOrdersResponseSchema.parse({ orders: [], nextCursor: null }).nextCursor).toBeNull();
  });

  /**
   * O contrato nao carrega identidade de quem comprou. Se carregasse, a tela
   * teria como exibir — e alguem acabaria exibindo.
   */
  it('nao expoe comprador, conta nem identificador de comunidade', () => {
    const chaves = Object.keys(accountOrdersResponseSchema.parse({ orders: [pedido], nextCursor: null }).orders[0]!);
    expect(chaves).not.toContain('userId');
    expect(chaves).not.toContain('buyerId');
    expect(chaves).not.toContain('tenantId');
    expect(chaves).not.toContain('email');
  });
});
