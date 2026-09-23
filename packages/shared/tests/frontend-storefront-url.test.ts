import { describe, expect, it } from 'vitest';
import { normalizeStorefrontBaseUrl, storefrontDrawUrl } from '../src/index.js';

/**
 * Endereco da vitrine montado a partir do painel.
 *
 * O defeito que estes testes travam e concreto: o painel usava um link
 * RELATIVO (`/sorteio/abc`), que resolvia contra o dominio do proprio painel.
 * A rota nao existe la, o roteador devolvia a pessoa ao dashboard, e nada
 * indicava que algo tinha dado errado.
 *
 * Por isso o caso mais importante aqui nao e o caminho feliz: e o de
 * CONFIGURACAO AUSENTE OU ERRADA. A funcao precisa recusar em vez de produzir
 * um endereco plausivel e quebrado.
 */
describe('endereco da vitrine', () => {
  describe('base normalizada', () => {
    it('base sem barra final fica como esta', () => {
      expect(normalizeStorefrontBaseUrl('https://vitrine.exemplo.com')).toBe(
        'https://vitrine.exemplo.com',
      );
    });

    it('base COM barra final perde a barra', () => {
      // Sem isto o resultado teria barra dupla: ".com//sorteio/abc".
      expect(normalizeStorefrontBaseUrl('https://vitrine.exemplo.com/')).toBe(
        'https://vitrine.exemplo.com',
      );
      expect(normalizeStorefrontBaseUrl('https://vitrine.exemplo.com///')).toBe(
        'https://vitrine.exemplo.com',
      );
    });

    it('espaco em volta e ignorado', () => {
      // Valor colado num painel de variaveis costuma vir com espaco.
      expect(normalizeStorefrontBaseUrl('  https://vitrine.exemplo.com  ')).toBe(
        'https://vitrine.exemplo.com',
      );
    });

    it('subcaminho e preservado', () => {
      // Instalacao que nao vive na raiz do dominio.
      expect(normalizeStorefrontBaseUrl('https://exemplo.com/loja/')).toBe(
        'https://exemplo.com/loja',
      );
    });

    it('porta e preservada', () => {
      expect(normalizeStorefrontBaseUrl('http://exemplo.com:5173')).toBe(
        'http://exemplo.com:5173',
      );
    });
  });

  describe('recusa em vez de inventar', () => {
    it('variavel ausente devolve null', () => {
      // `null` e o sinal para a interface ESCONDER o botao.
      expect(normalizeStorefrontBaseUrl(undefined)).toBeNull();
      expect(normalizeStorefrontBaseUrl(null)).toBeNull();
      expect(normalizeStorefrontBaseUrl('')).toBeNull();
      expect(normalizeStorefrontBaseUrl('   ')).toBeNull();
    });

    it('base RELATIVA e recusada', () => {
      // Este e o defeito original voltando disfarcado de configuracao: um
      // valor relativo concatenaria e resolveria contra o dominio do painel.
      expect(normalizeStorefrontBaseUrl('/vitrine')).toBeNull();
      expect(normalizeStorefrontBaseUrl('vitrine.exemplo.com')).toBeNull();
    });

    it('esquema que nao e http(s) e recusado', () => {
      expect(normalizeStorefrontBaseUrl('javascript:alert(1)')).toBeNull();
      expect(normalizeStorefrontBaseUrl('data:text/html,<p>')).toBeNull();
      expect(normalizeStorefrontBaseUrl('ftp://exemplo.com')).toBeNull();
    });
  });

  describe('endereco completo do sorteio', () => {
    it('monta base + /sorteio/ + slug', () => {
      expect(storefrontDrawUrl('https://vitrine.exemplo.com', 'rifa-da-moto')).toBe(
        'https://vitrine.exemplo.com/sorteio/rifa-da-moto',
      );
    });

    it('barra final na base nao vira barra dupla', () => {
      expect(storefrontDrawUrl('https://vitrine.exemplo.com/', 'rifa-da-moto')).toBe(
        'https://vitrine.exemplo.com/sorteio/rifa-da-moto',
      );
    });

    it('sem base configurada, nao ha endereco', () => {
      expect(storefrontDrawUrl(undefined, 'rifa-da-moto')).toBeNull();
      expect(storefrontDrawUrl('', 'rifa-da-moto')).toBeNull();
    });

    it('sem slug, nao ha endereco', () => {
      expect(storefrontDrawUrl('https://vitrine.exemplo.com', '')).toBeNull();
      expect(storefrontDrawUrl('https://vitrine.exemplo.com', '   ')).toBeNull();
      expect(storefrontDrawUrl('https://vitrine.exemplo.com', undefined)).toBeNull();
    });

    it('o slug e codificado e nao escapa do segmento', () => {
      // O slug vem do banco com formato validado, mas o encode e barato e
      // fecha a porta para o dia em que essa validacao mudar.
      expect(storefrontDrawUrl('https://ex.com', 'a/b')).toBe(
        'https://ex.com/sorteio/a%2Fb',
      );
      expect(storefrontDrawUrl('https://ex.com', '../admin')).toBe(
        'https://ex.com/sorteio/..%2Fadmin',
      );
    });

    it('base com subcaminho mantem o subcaminho', () => {
      expect(storefrontDrawUrl('https://exemplo.com/loja', 'natal-2026')).toBe(
        'https://exemplo.com/loja/sorteio/natal-2026',
      );
    });
  });
});
