import type { DrawStatus } from '@clubedarifa/shared';

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
const ROTULOS: Record<DrawStatus, { texto: string; variante: string; publico: string }> = {
  RASCUNHO: { texto: 'Rascunho', variante: 'badge--neutral', publico: 'Ainda não publicado' },
  'REVISÃO COMPLIANCE': { texto: 'Em revisão', variante: 'badge--neutral', publico: 'Ainda não publicado' },
  AGENDADA: { texto: 'Em breve', variante: 'badge--neutral', publico: 'As vendas ainda não começaram' },
  ATIVA: { texto: 'Vendas abertas', variante: 'badge--success badge--live', publico: 'Vendas abertas' },
  PAUSADA: { texto: 'Vendas pausadas', variante: 'badge--warning', publico: 'Vendas pausadas' },
  'VENDAS ENCERRADAS': {
    texto: 'Vendas encerradas',
    variante: 'badge--neutral',
    publico: 'Vendas encerradas',
  },
  APURAÇÃO: { texto: 'Em apuração', variante: 'badge--neutral', publico: 'Sorteio em apuração' },
  'RESULTADO PUBLICADO': {
    texto: 'Resultado publicado',
    variante: 'badge--success',
    publico: 'Resultado publicado',
  },
  ARQUIVADA: { texto: 'Encerrado', variante: 'badge--neutral', publico: 'Sorteio encerrado' },
  CANCELADA: { texto: 'Cancelado', variante: 'badge--danger', publico: 'Sorteio cancelado' },
};

export function StatusBadge({
  status,
  size = 'md',
}: {
  status: DrawStatus;
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
export function statusMessage(status: DrawStatus): string {
  return ROTULOS[status].publico;
}

export function isBuyable(status: DrawStatus): boolean {
  return status === 'ATIVA';
}
