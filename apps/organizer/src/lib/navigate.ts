/**
 * Saida para fora do painel (Stripe Checkout, Customer Portal, autorizacao do Mercado Pago).
 * Existe como funcao propria para que os testes possam observar o destino sem navegar de
 * verdade.
 *
 * So aceita `https://` (ou `http://` em desenvolvimento local): a URL vem do servidor, mas
 * um esquema inesperado nunca deve virar navegacao.
 */
export function redirectTo(url: string): void {
  const destino = new URL(url, window.location.href);
  if (destino.protocol !== 'https:' && destino.protocol !== 'http:') {
    throw new Error('Destino de redirecionamento invalido.');
  }
  window.location.assign(destino.toString());
}
