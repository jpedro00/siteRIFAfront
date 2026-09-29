import { useEffect, useState } from 'react';
import { CalendarClock, Flame } from 'lucide-react';
import { formatInteger, formatTimeUntil, remainingToSell, urgencyFor } from '@clubedarifa/shared';

/**
 * "Faltam X" e contagem para o sorteio, em UMA linha curta.
 *
 * FALTAM X = total - PAGOS (RN18/DOC-01 §11). Reserva e pendencia nao contam. Os
 * limiares de urgencia (25 e 10) mudam o TEXTO — "Reta final", "Últimos números" —, e
 * nao so a cor: o estado nunca e comunicado so por cor (RN28).
 *
 * O contador recalcula a cada minuto: "em 3 dias e 4 h" nao precisa de segundos, e um
 * temporizador por segundo em cada cartao da lista seria trabalho desperdicado.
 */
export function SalesHint({
  total,
  paid,
  drawDate,
  thresholds,
}: {
  total: number;
  paid: number;
  drawDate: string | null;
  thresholds?: readonly number[];
}) {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const faltam = remainingToSell(total, paid);
  const urgencia = urgencyFor(faltam, thresholds);
  const prazo = formatTimeUntil(drawDate, agora);

  const rotuloUrgencia =
    urgencia === 'critical' ? 'Últimos números' : urgencia === 'low' ? 'Reta final' : null;

  return (
    <p className={`sales-hint sales-hint--${urgencia}`}>
      {urgencia === 'soldout' ? (
        <strong>Esgotado</strong>
      ) : (
        <>
          {rotuloUrgencia && (
            <span className="sales-hint__flag">
              <Flame size={13} aria-hidden="true" />
              {rotuloUrgencia}
              {' · '}
            </span>
          )}
          <strong>
            Faltam {formatInteger(faltam)} {faltam === 1 ? 'número' : 'números'}
          </strong>
        </>
      )}
      {prazo && (
        <span className="sales-hint__date">
          <CalendarClock size={13} aria-hidden="true" /> sorteio {prazo}
        </span>
      )}
    </p>
  );
}
