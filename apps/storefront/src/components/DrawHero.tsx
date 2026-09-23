import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Lock, Timer } from 'lucide-react';
import { formatCents, formatInteger, type PublicDrawSummary } from '@campaigns/shared';
import { PrizeImage } from './PrizeImage.tsx';
import { ProgressBar } from './ProgressBar.tsx';
import { StatusBadge, isBuyable } from './StatusBadge.tsx';

/**
 * Vitrine do sorteio em destaque.
 *
 * E a primeira tela: precisa responder em segundos o que se ganha, quanto
 * custa e como participar. Por isso a ordem no CELULAR e imagem, premio,
 * preco, acao — o texto institucional da comunidade vem depois, porque nao e
 * o que faz alguem comprar.
 *
 * Os elementos de confianca (pagamento, prazo de reserva, numeros unicos) sao
 * afirmacoes verificaveis sobre o funcionamento real do sistema, nao selo
 * decorativo: a reserva expira mesmo em 30 minutos (RN05) e o mesmo numero
 * nao vai para duas pessoas — isso e garantido pelo banco, com teste de
 * concorrencia.
 */
export function DrawHero({ draw }: { draw: PublicDrawSummary }) {
  const vendendo = isBuyable(draw.status);

  return (
    <section className="hero">
      <div className="hero__media">
        <PrizeImage url={draw.prizeImageUrl} alt={draw.prizeName} priority />
      </div>

      <div className="hero__content">
        <div className="hero__badges">
          <StatusBadge status={draw.status} size="lg" />
        </div>

        <p className="eyebrow">Sorteio em destaque</p>
        <h1 className="hero__title">{draw.prizeName}</h1>
        <p className="hero__subtitle">{draw.title}</p>

        {draw.description && <p className="hero__description">{draw.description}</p>}

        <div className="hero__price">
          <span className="hero__price-label">Cada número por</span>
          <strong className="hero__price-value">{formatCents(draw.unitPriceCents)}</strong>
        </div>

        <ProgressBar paid={draw.paidCount} total={draw.totalNumbers} size="lg" />

        <div className="hero__actions">
          <Link
            className="btn btn--primary btn--lg hero__cta"
            to={`/sorteio/${draw.slug}`}
            aria-label={`Escolher números do sorteio ${draw.prizeName}`}
          >
            {vendendo ? 'Escolher números' : 'Ver o sorteio'}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <span className="hero__total-hint">
            {formatInteger(draw.totalNumbers)} números no total
          </span>
        </div>

        <ul className="trust">
          <li className="trust__item">
            <Lock size={15} aria-hidden="true" />
            Número garantido só para você
          </li>
          <li className="trust__item">
            <Timer size={15} aria-hidden="true" />
            30 minutos para concluir
          </li>
          <li className="trust__item">
            <BadgeCheck size={15} aria-hidden="true" />
            Comprovante na hora
          </li>
        </ul>
      </div>
    </section>
  );
}
