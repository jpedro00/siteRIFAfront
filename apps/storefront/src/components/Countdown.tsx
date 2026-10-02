import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';

/**
 * Contador regressivo ate o fechamento das vendas. Mostra dias, horas, minutos e segundos
 * em TEXTO; o leitor de tela recebe so o minuto (nao anuncia cada segundo).
 */
function partes(restanteMs: number) {
  const total = Math.max(0, Math.floor(restanteMs / 1000));
  return {
    dias: Math.floor(total / 86400),
    horas: Math.floor((total % 86400) / 3600),
    minutos: Math.floor((total % 3600) / 60),
    segundos: total % 60,
  };
}

export function Countdown({ until }: { until: string }) {
  const alvo = new Date(until).getTime();
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!Number.isFinite(alvo) || alvo <= agora) return null;
  const p = partes(alvo - agora);
  const texto = `${p.dias} d ${p.horas} h ${p.minutos} min ${p.segundos} s`;
  return (
    <div className="countdown">
      <span className="countdown__label">
        <Timer size={14} aria-hidden="true" /> As vendas encerram em
      </span>
      <strong className="countdown__value" aria-hidden="true">
        {texto}
      </strong>
      <span className="sr-only" role="timer">
        {`${p.dias} dias, ${p.horas} horas e ${p.minutos} minutos`}
      </span>
    </div>
  );
}
