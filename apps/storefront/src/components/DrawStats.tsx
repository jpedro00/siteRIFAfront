import { CalendarDays, Hash, Ticket, TrendingUp } from 'lucide-react';
import { formatCents, formatDate, formatInteger, type PublicDrawDetail } from '@campaigns/shared';

/**
 * Numeros do sorteio em destaque.
 *
 * Todo valor aqui vem da API. Quando um dado nao existe — data ainda nao
 * definida, por exemplo — o item SOME, em vez de mostrar tracinho ou "a
 * definir". Metrica inventada para preencher grade e como a confianca se
 * perde de vez.
 */
export function DrawStats({ draw }: { draw: PublicDrawDetail }) {
  const dataSorteio = formatDate(draw.drawDate);
  const disponiveis = Math.max(0, draw.totalNumbers - draw.takenCount);

  const itens = [
    {
      Icone: Ticket,
      rotulo: 'Valor por número',
      valor: formatCents(draw.unitPriceCents),
      destaque: true,
    },
    {
      Icone: Hash,
      rotulo: 'Números disponíveis',
      valor: `${formatInteger(disponiveis)} de ${formatInteger(draw.totalNumbers)}`,
      destaque: false,
    },
    {
      // RN18: vendido e o que foi PAGO.
      Icone: TrendingUp,
      rotulo: 'Números vendidos',
      valor: formatInteger(draw.paidCount),
      destaque: false,
    },
    ...(dataSorteio
      ? [{ Icone: CalendarDays, rotulo: 'Data do sorteio', valor: dataSorteio, destaque: false }]
      : []),
  ];

  return (
    <dl className="draw-stats">
      {itens.map(({ Icone, rotulo, valor, destaque }) => (
        <div key={rotulo} className={`draw-stat${destaque ? ' draw-stat--accent' : ''}`}>
          <dt className="draw-stat__label">
            <Icone size={14} aria-hidden="true" />
            {rotulo}
          </dt>
          <dd className="draw-stat__value">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}
