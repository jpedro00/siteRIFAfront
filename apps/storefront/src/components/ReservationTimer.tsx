import { useEffect, useState } from 'react';
import { AlarmClock } from 'lucide-react';
import { formatCountdown } from '@campaigns/shared';

/**
 * Contagem regressiva da reserva (RN05 · 30 minutos).
 *
 * O prazo e do SERVIDOR: `expiresAt` veio com a reserva e o banco e quem
 * decide se ela ainda vale. Este cronometro so mostra — se o relogio do
 * aparelho estiver adiantado, o pior que acontece e a tela avisar antes, e
 * nunca depois, de o servidor recusar.
 *
 * Atualiza a cada segundo. `setTimeout` encadeado em vez de `setInterval`
 * porque a aba em segundo plano estrangula os temporizadores e o intervalo
 * acumularia disparos atrasados de uma vez ao voltar; recalcular a partir do
 * relogio a cada passo mantem o numero certo mesmo depois de a aba dormir.
 *
 * ACESSIBILIDADE — o detalhe que decide se isto ajuda ou atrapalha:
 * o numero que corre e `aria-hidden`. Uma regiao viva que muda a cada segundo
 * faz o leitor de tela falar sem parar e torna a pagina inutilizavel. Quem
 * usa leitor recebe apenas os MARCOS — 10, 5 e 1 minuto e o vencimento —,
 * que e a informacao de que precisa: nao o segundo exato, mas o aviso de que
 * o tempo esta acabando.
 */
const MARCOS_MINUTOS = [10, 5, 1];

export function ReservationTimer({
  expiresAt,
  onExpire,
  compact = false,
}: {
  expiresAt: string;
  onExpire?: () => void;
  compact?: boolean;
}) {
  const alvo = new Date(expiresAt).getTime();
  const [restante, setRestante] = useState(() => Math.max(0, alvo - Date.now()));
  const [anuncio, setAnuncio] = useState('');

  useEffect(() => {
    let id: number;
    let ultimoMarco = Number.POSITIVE_INFINITY;

    const passo = () => {
      const agora = Math.max(0, alvo - Date.now());
      setRestante(agora);

      if (agora <= 0) {
        setAnuncio('Sua reserva expirou. Os números voltaram a ficar disponíveis.');
        onExpire?.();
        return;
      }

      const minutos = Math.ceil(agora / 60_000);
      const marco = MARCOS_MINUTOS.find((m) => minutos === m && m < ultimoMarco);
      if (marco !== undefined) {
        ultimoMarco = marco;
        setAnuncio(
          `Resta ${marco} ${marco === 1 ? 'minuto' : 'minutos'} para concluir sua compra.`,
        );
      }

      id = window.setTimeout(passo, 1000);
    };

    passo();
    return () => window.clearTimeout(id);
  }, [alvo, onExpire]);

  const vencida = restante <= 0;
  const urgente = !vencida && restante <= 5 * 60_000;

  return (
    <div
      className={`timer${urgente ? ' timer--urgent' : ''}${vencida ? ' timer--expired' : ''}${compact ? ' timer--compact' : ''}`}
    >
      <AlarmClock size={compact ? 14 : 16} aria-hidden="true" />

      {vencida ? (
        <span className="timer__text">Sua reserva expirou</span>
      ) : (
        <span className="timer__text" aria-hidden="true">
          <span className="timer__value">{formatCountdown(restante)}</span>
          <span className="timer__label"> para concluir</span>
        </span>
      )}

      {/* Descricao estavel para leitor de tela, fora da contagem. */}
      {!vencida && (
        <span className="sr-only">
          Você tem 30 minutos para concluir a compra a partir da reserva.
        </span>
      )}

      {/* Só os marcos passam por aqui. */}
      <span className="sr-only" role="status" aria-live="polite">
        {anuncio}
      </span>
    </div>
  );
}
