/**
 * Apresentacao de prazo e de "faltam X". Regras de exibicao, sem estado.
 *
 * "FALTAM X" (DOC-01 §11 · RN18) = total - numeros PAGO. Reserva e pendencia NUNCA
 * contam como vendidas. Nao e o mesmo que "numeros disponiveis": um numero reservado
 * por outra pessoa nao foi vendido e tambem nao esta livre. Por isso a pagina do
 * sorteio mostra as duas coisas, com rotulos diferentes.
 */

/** Quantos numeros ainda nao foram vendidos (PAGO). Nunca negativo. */
export function remainingToSell(total: number, paid: number): number {
  return Math.max(0, total - paid);
}

export type Urgency = 'none' | 'low' | 'critical' | 'soldout';

/**
 * Quao perto de esgotar. Os limiares vem do sorteio (padrao 25 e 10): o primeiro
 * marca "reta final", o segundo "ultimos numeros". Sem limiares, usa os padroes.
 */
export function urgencyFor(remaining: number, thresholds: readonly number[] = [25, 10]): Urgency {
  if (remaining <= 0) return 'soldout';
  const ordenados = [...thresholds].sort((a, b) => a - b);
  const [critico, baixo] = [ordenados[0], ordenados[1] ?? ordenados[0]];
  if (critico !== undefined && remaining <= critico) return 'critical';
  if (baixo !== undefined && remaining <= baixo) return 'low';
  return 'none';
}

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

/**
 * "em 3 dias e 4 h", "em 2 h 15 min", "em 12 min", "agora". `null` quando a data
 * ja passou ou nao existe — o chamador esconde o contador em vez de mostrar "-2 dias".
 */
export function formatTimeUntil(iso: string | null | undefined, now: number = Date.now()): string | null {
  if (!iso) return null;
  const alvo = Date.parse(iso);
  if (Number.isNaN(alvo)) return null;
  const falta = alvo - now;
  if (falta <= 0) return null;

  if (falta >= DIA) {
    const dias = Math.floor(falta / DIA);
    const horas = Math.floor((falta % DIA) / HORA);
    return `em ${dias} ${dias === 1 ? 'dia' : 'dias'}${horas > 0 ? ` e ${horas} h` : ''}`;
  }
  if (falta >= HORA) {
    const horas = Math.floor(falta / HORA);
    const min = Math.floor((falta % HORA) / MIN);
    return `em ${horas} h${min > 0 ? ` ${min} min` : ''}`;
  }
  if (falta >= MIN) return `em ${Math.floor(falta / MIN)} min`;
  return 'agora';
}
