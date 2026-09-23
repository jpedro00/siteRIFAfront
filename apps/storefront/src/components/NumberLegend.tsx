import { Check, Clock, Lock, ShoppingCart } from 'lucide-react';

/**
 * Legenda da grade.
 *
 * Nao e enfeite: e a peca que torna a grade compreensivel sem depender de
 * cor. Sem ela, "amarelo" e "azul" nao querem dizer nada para quem chega
 * agora — e nada mesmo para quem nao distingue os dois.
 *
 * Fica ANTES da grade na ordem do DOM para que o leitor de tela apresente o
 * vocabulario antes dos mil botoes que o utilizam.
 */

const ITENS = [
  { classe: 'is-free', rotulo: 'Disponível', Icone: null },
  { classe: 'is-selected', rotulo: 'Sua escolha', Icone: Check },
  { classe: 'is-reserved', rotulo: 'Reservado', Icone: Clock },
  { classe: 'is-pending', rotulo: 'Aguardando pagamento', Icone: ShoppingCart },
  { classe: 'is-paid', rotulo: 'Vendido', Icone: Check },
  { classe: 'is-captive', rotulo: 'Indisponível', Icone: Lock },
] as const;

export function NumberLegend({ compact = false }: { compact?: boolean }) {
  return (
    <ul className={`legend${compact ? ' legend--compact' : ''}`} aria-label="Legenda dos números">
      {ITENS.map(({ classe, rotulo, Icone }) => (
        <li key={rotulo} className="legend__item">
          <span className={`legend__swatch ${classe}`} aria-hidden="true">
            {Icone ? <Icone size={10} strokeWidth={3} /> : null}
          </span>
          <span className="legend__label">{rotulo}</span>
        </li>
      ))}
    </ul>
  );
}
