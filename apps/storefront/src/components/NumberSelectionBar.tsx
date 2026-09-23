import { useEffect, useRef, useState } from 'react';
import { ChevronUp, ShoppingCart, X } from 'lucide-react';
import { formatCents, formatNumberLabel } from '@campaigns/shared';

/**
 * Barra de selecao fixa no rodape (celular).
 *
 * No telefone a grade ocupa a tela inteira e o painel de compra fica longe,
 * fora de vista. Esta barra resolve isso: quantidade, total e o botao de
 * comprar ficam SEMPRE visiveis, e a lista completa dos numeros escolhidos
 * abre numa folha, so quando a pessoa quiser conferir.
 *
 * Ela nao aparece com zero selecionado — uma barra permanentemente colada ao
 * rodape rouba altura util da grade sem oferecer nada em troca.
 *
 * `padding-bottom: env(safe-area-inset-bottom)` no CSS mantem o botao acima
 * da barra de gestos do iPhone.
 */
export function NumberSelectionBar({
  selected,
  labelDigits,
  unitPriceCents,
  onRemove,
  onClear,
  onSubmit,
  submitting,
  disabled,
}: {
  selected: readonly number[];
  labelDigits: 2 | 3;
  unitPriceCents: number;
  onRemove: (value: number) => void;
  onClear: () => void;
  onSubmit: () => void;
  submitting: boolean;
  disabled: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  const resumoRef = useRef<HTMLButtonElement>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberta) return;
    fecharRef.current?.focus();

    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setAberta(false);
      requestAnimationFrame(() => resumoRef.current?.focus());
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberta]);

  if (selected.length === 0) return null;

  const total = selected.length * unitPriceCents;

  return (
    <>
      {aberta && (
        <>
          <div className="overlay" onClick={() => setAberta(false)} aria-hidden="true" />
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Números selecionados">
            <div className="sheet__handle" aria-hidden="true" />
            <div className="sheet__header">
              <h2 className="sheet__title">
                {selected.length} {selected.length === 1 ? 'número' : 'números'}
              </h2>
              <button
                ref={fecharRef}
                type="button"
                className="btn btn--ghost btn--icon btn--sm"
                aria-label="Fechar"
                onClick={() => setAberta(false)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="sheet__body">
              <ul className="chip-list">
                {selected.map((valor) => (
                  <li key={valor}>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => onRemove(valor)}
                      aria-label={`Remover número ${formatNumberLabel(valor, labelDigits)}`}
                    >
                      {formatNumberLabel(valor, labelDigits)}
                      <X size={12} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>

              <button type="button" className="btn btn--ghost btn--sm" onClick={onClear}>
                Limpar seleção
              </button>
            </div>

            <div className="sheet__footer">
              <div className="selection-bar__totals">
                <span className="muted">Total</span>
                <strong className="selection-bar__total">{formatCents(total)}</strong>
              </div>
              <button
                type="button"
                className="btn btn--primary btn--lg btn--block"
                onClick={onSubmit}
                disabled={disabled || submitting}
              >
                {submitting ? <span className="btn__spinner" aria-hidden="true" /> : null}
                {submitting ? 'Reservando…' : 'Reservar e continuar'}
              </button>
            </div>
          </div>
        </>
      )}

      <div className="selection-bar">
        <button
          ref={resumoRef}
          type="button"
          className="selection-bar__summary"
          onClick={() => setAberta(true)}
          aria-expanded={aberta}
        >
          <span className="selection-bar__count">
            <ShoppingCart size={16} aria-hidden="true" />
            {selected.length} {selected.length === 1 ? 'número' : 'números'}
            <ChevronUp size={14} aria-hidden="true" />
          </span>
          <strong className="selection-bar__total">{formatCents(total)}</strong>
        </button>

        <button
          type="button"
          className="btn btn--primary selection-bar__cta"
          onClick={onSubmit}
          disabled={disabled || submitting}
        >
          {submitting ? <span className="btn__spinner" aria-hidden="true" /> : null}
          {submitting ? 'Reservando…' : 'Reservar'}
        </button>
      </div>
    </>
  );
}
