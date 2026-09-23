import { formatCents, formatNumberLabel } from '@campaigns/shared';

/**
 * Resumo do que esta sendo comprado.
 *
 * Aparece no checkout e no comprovante. O total e sempre recalculado a partir
 * de quantidade x preco unitario exibidos logo acima — a conta fica a vista,
 * e nao ha diferenca possivel entre o que a tela soma e o que ela cobra.
 *
 * O servidor tambem valida a conta: a tabela `orders` tem uma CHECK de que
 * `total_cents = unit_price_cents * quantity`. Esta tela mostra; o banco
 * garante.
 */
export function CheckoutSummary({
  drawTitle,
  numbers,
  labelDigits,
  unitPriceCents,
  totalCents,
}: {
  drawTitle: string;
  numbers: readonly number[];
  labelDigits: 2 | 3;
  unitPriceCents: number;
  totalCents: number;
}) {
  return (
    <div className="summary">
      <h2 className="summary__title">Resumo do pedido</h2>

      <p className="summary__draw">{drawTitle}</p>

      <div className="summary__numbers">
        <p className="summary__numbers-label">
          {numbers.length === 1 ? 'Seu número' : `Seus ${numbers.length} números`}
        </p>
        <ul className="chip-list chip-list--static">
          {numbers.map((valor) => (
            <li key={valor} className="chip chip--static">
              {formatNumberLabel(valor, labelDigits)}
            </li>
          ))}
        </ul>
      </div>

      <dl className="summary__lines">
        <div className="summary__line">
          <dt>Valor por número</dt>
          <dd>{formatCents(unitPriceCents)}</dd>
        </div>
        <div className="summary__line">
          <dt>Quantidade</dt>
          <dd>
            {numbers.length} {numbers.length === 1 ? 'número' : 'números'}
          </dd>
        </div>
        <div className="summary__line summary__line--total">
          <dt>Total</dt>
          <dd>{formatCents(totalCents)}</dd>
        </div>
      </dl>
    </div>
  );
}
