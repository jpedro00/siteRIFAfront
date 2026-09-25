/**
 * Referencia curta do pedido, para leitura humana.
 *
 * O UUID inteiro nao serve de referencia: ninguem dita
 * "9eba7453-1be0-4ba5-8a17-7c64c31a210f" por telefone nem confere isso numa
 * lista. Mas esconde-lo por completo tambem nao serve — o comprovante impresso
 * ficava sem identificador nenhum, e quem imprime e depois precisa casar o
 * papel com o registro da organizacao nao teria por onde comecar.
 *
 * Seis digitos hexadecimais resolvem os dois lados: curto o bastante para ler
 * em voz alta, e derivado do identificador real, sem campo novo, contrato novo
 * nem schema novo.
 *
 * ISTO NAO E CHAVE DE NEGOCIO. Nao e enviado a API, nao e usado em rota e nao
 * precisa ser unico globalmente — 16,7 milhoes de combinacoes colidem bem
 * antes disso, e tudo bem: serve para CONFERIR um pedido que ja se tem em
 * maos, nao para LOCALIZAR um entre todos. A busca continua sendo pelo
 * `orderId` completo, que e o que a API recebe.
 */
export function shortOrderReference(orderId: string): string {
  return orderId.replace(/-/g, '').slice(-6).toUpperCase();
}
