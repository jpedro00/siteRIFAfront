import { formatCents, formatDateTime, type PublicDrawSummary } from '@clubedarifa/shared';

/**
 * Selo da promoção, ao lado do preço efetivo. RN15 · RN28.
 *
 * O preço que vale (`unitPriceCents`) já vem decidido pelo servidor. Este
 * componente só EXPLICA: mostra o preço cheio riscado e até quando a promoção
 * vale. O estado vai escrito ("Promoção", "de … por …"), nunca só em cor, e o
 * preço riscado ganha texto para leitor de tela — o `<s>` sozinho não diz nada.
 *
 * Sem promoção vigente não renderiza nada: promoção vencida some da vitrine.
 */
export function PromoNote({ draw }: { draw: PublicDrawSummary }) {
  if (!draw.promoActive) return null;
  const ate = formatDateTime(draw.promoUntil);

  return (
    <span className="promo-note">
      <span className="badge badge--success">Promoção</span>
      <span className="promo-note__was">
        <span className="sr-only">Preço cheio: </span>
        <s>{formatCents(draw.ticketPriceCents)}</s>
      </span>
      {ate && <span className="promo-note__until">até {ate}</span>}
    </span>
  );
}
