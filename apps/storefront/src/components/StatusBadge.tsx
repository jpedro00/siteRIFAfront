import type { DrawStatusPhase2 } from '@campaigns/shared';

/**
 * Selo de estado do sorteio.
 *
 * Traduz o estado do dominio para o que o participante precisa saber. Ele nao
 * quer ler "PAUSADA": quer saber se pode comprar agora.
 *
 * RASCUNHO nao aparece na vitrine — sorteio em construcao nao chega ao
 * publico —, mas esta mapeado porque o mesmo componente serve ao painel, e um
 * `undefined` vazando para a tela seria pior que um rotulo a mais.
 */
const ROTULOS: Record<DrawStatusPhase2, { texto: string; variante: string; publico: string }> = {
  RASCUNHO: { texto: 'Rascunho', variante: 'badge--neutral', publico: 'Ainda não publicado' },
  ATIVA: { texto: 'Vendas abertas', variante: 'badge--success badge--live', publico: 'Vendas abertas' },
  PAUSADA: { texto: 'Vendas pausadas', variante: 'badge--warning', publico: 'Vendas pausadas' },
  'VENDAS ENCERRADAS': {
    texto: 'Vendas encerradas',
    variante: 'badge--neutral',
    publico: 'Vendas encerradas',
  },
};

export function StatusBadge({
  status,
  size = 'md',
}: {
  status: DrawStatusPhase2;
  size?: 'md' | 'lg';
}) {
  const info = ROTULOS[status];
  return (
    <span className={`badge ${info.variante}${size === 'lg' ? ' badge--lg' : ''}`}>
      <span className="badge__dot" aria-hidden="true" />
      {info.texto}
    </span>
  );
}

/** Frase curta sobre poder comprar ou nao. */
export function statusMessage(status: DrawStatusPhase2): string {
  return ROTULOS[status].publico;
}

export function isBuyable(status: DrawStatusPhase2): boolean {
  return status === 'ATIVA';
}
