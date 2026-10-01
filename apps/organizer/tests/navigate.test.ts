import { describe, expect, it } from 'vitest';
import { redirectTo } from '../src/lib/navigate.ts';

/**
 * A saida do painel (Stripe Checkout, Customer Portal, autorizacao do Mercado Pago) so segue
 * para HTTP(S). Os demais testes trocam `redirectTo` por um dublê; este exercita a guarda real.
 * (O caminho feliz navega o `window.location`, que o jsdom nao implementa: nao e testado aqui.)
 */
describe('redirectTo · esquemas recusados', () => {
  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'blob:https://exemplo.test/uuid',
    'ftp://exemplo.test/arquivo',
  ])('recusa %s', (url) => {
    expect(() => redirectTo(url)).toThrow('Destino de redirecionamento invalido.');
  });
});
