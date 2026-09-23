import { memo } from 'react';
import { Check, Clock, Lock, ShoppingCart } from 'lucide-react';
import { formatNumberLabel } from '@campaigns/shared';

/**
 * Uma celula da grade.
 *
 * ACESSIBILIDADE — a regra central desta tela
 * -------------------------------------------
 * O estado de um numero NUNCA e comunicado so pela cor. Cada estado carrega
 * quatro sinais independentes:
 *
 *   1. cor de fundo      (quem enxerga cor)
 *   2. espessura/estilo de borda  (quem nao enxerga)
 *   3. icone             (forma, legivel em escala de cinza)
 *   4. aria-label        (leitor de tela)
 *
 * Cerca de 8% dos homens tem alguma deficiencia na visao de cores. Numa tela
 * cujo unico proposito e distinguir "posso comprar" de "ja e de outro", tratar
 * cor como informacao suficiente seria excluir gente da compra.
 *
 * PERFORMANCE
 * -----------
 * `memo` nao e otimizacao prematura aqui: numa grade de 1000, selecionar um
 * numero redesenharia as outras 999. Com `memo`, so muda a celula tocada. As
 * props sao todas primitivas, entao a comparacao rasa padrao ja basta.
 */

export type CellState = 'LIVRE' | 'SELECIONADO' | 'RESERVADO' | 'PENDENTE' | 'PAGO' | 'CATIVO';

/** Como cada estado se apresenta e, sobretudo, como ele e ANUNCIADO. */
const APRESENTACAO: Record<
  CellState,
  { classe: string; anuncio: string; Icone: typeof Check | null }
> = {
  LIVRE: { classe: 'is-free', anuncio: 'disponível', Icone: null },
  SELECIONADO: { classe: 'is-selected', anuncio: 'selecionado por você', Icone: Check },
  RESERVADO: { classe: 'is-reserved', anuncio: 'reservado, indisponível', Icone: Clock },
  PENDENTE: { classe: 'is-pending', anuncio: 'aguardando pagamento, indisponível', Icone: ShoppingCart },
  PAGO: { classe: 'is-paid', anuncio: 'vendido', Icone: Check },
  CATIVO: { classe: 'is-captive', anuncio: 'indisponível', Icone: Lock },
};

interface NumberCellProps {
  readonly value: number;
  readonly labelDigits: 2 | 3;
  readonly state: CellState;
  readonly onToggle?: ((value: number) => void) | undefined;
}

function NumberCellBase({ value, labelDigits, state, onToggle }: NumberCellProps) {
  const rotulo = formatNumberLabel(value, labelDigits);
  const { classe, anuncio, Icone } = APRESENTACAO[state];
  const selecionavel = state === 'LIVRE' || state === 'SELECIONADO';

  return (
    <button
      type="button"
      className={`number-cell ${classe}`}
      // `aria-pressed` transforma o botao em alternador para o leitor de tela:
      // ele passa a anunciar "marcado"/"nao marcado" a cada toque, sem que a
      // pessoa precise reencontrar a celula para conferir o que aconteceu.
      aria-pressed={selecionavel ? state === 'SELECIONADO' : undefined}
      aria-label={`Número ${rotulo}, ${anuncio}`}
      disabled={!selecionavel}
      onClick={selecionavel && onToggle ? () => onToggle(value) : undefined}
    >
      {Icone ? <Icone className="number-cell__icon" size={12} aria-hidden="true" /> : null}
      <span className="number-cell__label">{rotulo}</span>
    </button>
  );
}

export const NumberCell = memo(NumberCellBase);
