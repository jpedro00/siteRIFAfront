import { describe, expect, it } from 'vitest';
import {
  formatCents,
  formatCentsCompact,
  formatCountdown,
  formatInteger,
  formatNumberLabel,
  formatPhoneBR,
  initialsOf,
  labelDigitsForGridSize,
  percentOf,
  phoneDigits,
} from '../src/index.js';

/**
 * Formatacao de apresentacao.
 *
 * Estas funcoes desenham DINHEIRO, NUMERO SORTEADO e PRAZO — as tres coisas
 * que o participante confere antes de pagar. Um erro aqui nao quebra a tela:
 * mostra o valor errado, que e pior, porque passa despercebido.
 */
describe('formatacao da interface', () => {
  describe('dinheiro', () => {
    it('centavos viram reais com duas casas', () => {
      // O Intl do pt-BR separa simbolo e valor com U+00A0 (espaco
      // inquebravel), nao com espaco comum. Normalizar antes de comparar
      // evita um teste que falha por um caractere invisivel. O caractere e
      // construido por codigo em vez de escrito: um NBSP literal no fonte e
      // exatamente o tipo de coisa que ninguem consegue revisar.
      const normalizar = (texto: string) => texto.replace(new RegExp(String.fromCharCode(160), 'g'), ' ');

      expect(normalizar(formatCents(1500))).toBe('R$ 15,00');
      expect(normalizar(formatCents(1))).toBe('R$ 0,01');
      expect(normalizar(formatCents(0))).toBe('R$ 0,00');
      expect(normalizar(formatCents(123456))).toBe('R$ 1.234,56');
    });

    it('a forma compacta so esconde os centavos quando eles sao zero', () => {
      const normalizar = (texto: string) => texto.replace(new RegExp(String.fromCharCode(160), 'g'), ' ');

      expect(normalizar(formatCentsCompact(1500))).toBe('R$ 15');
      // Com centavos, mostra tudo: arredondar "R$ 15,90" para "R$ 16" num
      // painel de arrecadacao seria inventar noventa centavos.
      expect(normalizar(formatCentsCompact(1590))).toBe('R$ 15,90');
    });

    it('nao perde centavo em valores grandes', () => {
      // 999.999,99 — a multiplicacao por 100 em ponto flutuante e onde o
      // centavo costuma sumir.
      expect(formatCents(99_999_999)).toContain('999.999,99');
    });
  });

  describe('progresso', () => {
    it('arredonda para BAIXO', () => {
      // 999 de 1000 nao pode virar 100%: quem chegasse a tela iria embora
      // achando que perdeu o ultimo numero.
      expect(percentOf(999, 1000)).toBe(99);
      expect(percentOf(1, 1000)).toBe(0);
      expect(percentOf(1000, 1000)).toBe(100);
      expect(percentOf(50, 100)).toBe(50);
    });

    it('grade vazia nao divide por zero', () => {
      expect(percentOf(0, 0)).toBe(0);
      expect(percentOf(5, 0)).toBe(0);
    });

    it('nunca passa de 100 nem desce de 0', () => {
      expect(percentOf(1500, 1000)).toBe(100);
      expect(percentOf(-5, 100)).toBe(0);
    });
  });

  describe('rotulo do numero (RN13)', () => {
    it('a grade de 100 usa dois digitos e as demais usam tres', () => {
      expect(labelDigitsForGridSize(100)).toBe(2);
      expect(labelDigitsForGridSize(500)).toBe(3);
      expect(labelDigitsForGridSize(1000)).toBe(3);
    });

    it('o mesmo numero se escreve diferente conforme a grade', () => {
      // O 5 de uma grade de 100 e "05"; o de uma grade de 1000 e "005". E por
      // isso que o comprovante precisa carregar `labelDigits`: sem ele, o
      // recibo mostraria um numero que nao e o que a pessoa escolheu.
      expect(formatNumberLabel(5, 2)).toBe('05');
      expect(formatNumberLabel(5, 3)).toBe('005');
      expect(formatNumberLabel(99, 2)).toBe('99');
      expect(formatNumberLabel(999, 3)).toBe('999');
      expect(formatNumberLabel(0, 3)).toBe('000');
    });

    it('grade fora da RN13 e recusada em vez de assumir um padrao', () => {
      expect(() => labelDigitsForGridSize(250)).toThrow(RangeError);
      expect(() => labelDigitsForGridSize(0)).toThrow(RangeError);
    });
  });

  describe('contagem regressiva', () => {
    it('mostra minutos e segundos', () => {
      expect(formatCountdown(30 * 60_000)).toBe('30:00');
      expect(formatCountdown(65_000)).toBe('01:05');
      expect(formatCountdown(9_000)).toBe('00:09');
    });

    it('acima de uma hora, mostra a hora', () => {
      expect(formatCountdown(3_600_000)).toBe('1:00:00');
      expect(formatCountdown(3_725_000)).toBe('1:02:05');
    });

    it('nunca conta para tras', () => {
      // Relogio do aparelho adiantado em relacao ao servidor produz negativo.
      // Um cronometro em "-00:14" assusta sem informar nada.
      expect(formatCountdown(0)).toBe('00:00');
      expect(formatCountdown(-60_000)).toBe('00:00');
    });
  });

  describe('telefone', () => {
    it('aplica a mascara conforme a pessoa digita', () => {
      expect(formatPhoneBR('11')).toBe('(11');
      expect(formatPhoneBR('1198')).toBe('(11) 98');
      expect(formatPhoneBR('1198887777')).toBe('(11) 9888-7777');
      expect(formatPhoneBR('11988887777')).toBe('(11) 98888-7777');
    });

    it('aceita um numero ja formatado sem duplicar a mascara', () => {
      // Colar "(11) 98888-7777" e comum. O campo nao pode brigar com isso.
      expect(formatPhoneBR('(11) 98888-7777')).toBe('(11) 98888-7777');
    });

    it('descarta o excesso em vez de crescer sem limite', () => {
      expect(formatPhoneBR('119888877779999')).toBe('(11) 98888-7777');
    });

    it('so os digitos viajam para o servidor', () => {
      expect(phoneDigits('(11) 98888-7777')).toBe('11988887777');
      expect(phoneDigits('+55 11 98888 7777')).toBe('5511988887777');
    });

    it('campo vazio continua vazio', () => {
      expect(formatPhoneBR('')).toBe('');
      expect(formatPhoneBR('abc')).toBe('');
    });
  });

  describe('iniciais', () => {
    it('usa o primeiro e o ultimo nome', () => {
      expect(initialsOf('Maria Silva Santos')).toBe('MS');
      expect(initialsOf('Ana Costa')).toBe('AC');
    });

    it('com um nome so, usa as duas primeiras letras', () => {
      expect(initialsOf('Joana')).toBe('JO');
    });

    it('sem nome utilizavel, devolve um marcador em vez de vazio', () => {
      // Um circulo em branco no canto da tela parece falha de carregamento.
      expect(initialsOf('')).toBe('?');
      expect(initialsOf('   ')).toBe('?');
      expect(initialsOf(null)).toBe('?');
      expect(initialsOf(undefined)).toBe('?');
    });
  });

  describe('inteiros', () => {
    it('usa separador de milhar do portugues', () => {
      expect(formatInteger(1000)).toBe('1.000');
      expect(formatInteger(999)).toBe('999');
    });
  });
});
