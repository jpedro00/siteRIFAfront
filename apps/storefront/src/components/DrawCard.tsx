import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { formatCents, type PublicDrawSummary } from '@campaigns/shared';
import { PrizeImage } from './PrizeImage.tsx';
import { ProgressBar } from './ProgressBar.tsx';
import { StatusBadge } from './StatusBadge.tsx';

/**
 * Cartao de sorteio na listagem.
 *
 * O cartao inteiro e clicavel, mas o link de verdade e o do titulo: um
 * `<article>` com `onClick` nao recebe foco, nao responde ao Enter e nao
 * aparece na lista de links do leitor de tela. A area extra e conveniencia
 * para o mouse — o `::after` esticado sobre o cartao pertence ao <a>, que
 * continua sendo um link honesto.
 */
export function DrawCard({ draw }: { draw: PublicDrawSummary }) {
  return (
    <article className="card card--interactive draw-card">
      <PrizeImage url={draw.prizeImageUrl} alt={draw.prizeName} />

      <div className="card__body stack stack--sm">
        <div className="row row--between">
          <StatusBadge status={draw.status} />
          <span className="draw-card__price">{formatCents(draw.unitPriceCents)}</span>
        </div>

        <h3 className="draw-card__title">
          <Link className="draw-card__link" to={`/sorteio/${draw.slug}`}>
            {draw.prizeName}
          </Link>
        </h3>

        <p className="draw-card__subtitle">{draw.title}</p>

        <ProgressBar paid={draw.paidCount} total={draw.totalNumbers} />

        <span className="draw-card__cta" aria-hidden="true">
          Ver sorteio
          <ArrowRight size={14} />
        </span>
      </div>
    </article>
  );
}
