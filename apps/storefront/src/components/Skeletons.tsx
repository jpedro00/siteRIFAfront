/**
 * Esqueletos de carregamento.
 *
 * Preferidos ao "Carregando…" porque preservam o LAYOUT: quando o dado chega,
 * o conteudo ocupa o espaco que ja estava reservado, em vez de empurrar a
 * pagina para baixo debaixo do dedo de quem ja ia tocar num botao.
 *
 * Todos sao `aria-hidden` e vem acompanhados de um aviso em regiao viva. Um
 * leitor de tela nao deve narrar retangulos cinzas; deve ouvir "Carregando os
 * sorteios" uma vez.
 */

function Aviso({ label }: { label: string }) {
  return (
    <p className="sr-only" role="status" aria-live="polite">
      {label}
    </p>
  );
}

export function HeroSkeleton() {
  return (
    <>
      <Aviso label="Carregando o sorteio em destaque." />
      <section className="hero" aria-hidden="true">
        <div className="hero__media">
          <div className="skeleton prize-image prize-image--wide" />
        </div>
        <div className="hero__content stack">
          <div className="skeleton skeleton--text" style={{ width: '30%' }} />
          <div className="skeleton skeleton--title" style={{ width: '80%' }} />
          <div className="skeleton skeleton--text" style={{ width: '60%' }} />
          <div className="skeleton skeleton--block" style={{ height: 72 }} />
          <div className="skeleton skeleton--text" style={{ width: '100%' }} />
          <div className="skeleton" style={{ height: 52, borderRadius: 14, width: 220 }} />
        </div>
      </section>
    </>
  );
}

export function DrawCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      <Aviso label="Carregando os sorteios." />
      <div className="draw-list" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <article key={i} className="card draw-card">
            <div className="skeleton prize-image prize-image--wide" />
            <div className="card__body stack stack--sm">
              <div className="skeleton skeleton--text" style={{ width: '40%' }} />
              <div className="skeleton skeleton--title" style={{ width: '75%' }} />
              <div className="skeleton skeleton--text" style={{ width: '100%' }} />
              <div className="skeleton skeleton--text" style={{ width: '55%' }} />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

/**
 * Esqueleto da grade.
 *
 * Desenha 60 celulas, nao as 1000 da grade real: o esqueleto existe para
 * sinalizar "vem uma grade aqui", e montar mil elementos descartaveis
 * competiria com o carregamento de verdade justo no aparelho mais fraco.
 */
export function NumberGridSkeleton() {
  return (
    <>
      <Aviso label="Carregando os números do sorteio." />
      <div className="grid-panel" aria-hidden="true">
        <div className="grid-panel__head">
          <div className="stack stack--sm" style={{ flex: 1 }}>
            <div className="skeleton skeleton--title" style={{ width: 200 }} />
            <div className="skeleton skeleton--text" style={{ width: 260 }} />
          </div>
        </div>
        <div className="number-grid">
          {Array.from({ length: 60 }, (_, i) => (
            <span key={i} className="number-slot">
              <span className="skeleton number-cell" />
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

export function DetailSkeleton() {
  return (
    <>
      <Aviso label="Carregando o sorteio." />
      <div className="draw-layout" aria-hidden="true">
        <div className="draw-layout__main stack stack--lg">
          <div className="skeleton prize-image prize-image--wide" />
          <div className="skeleton skeleton--title" style={{ width: '70%' }} />
          <div className="skeleton skeleton--text" style={{ width: '100%' }} />
          <div className="skeleton skeleton--text" style={{ width: '90%' }} />
          <div className="skeleton skeleton--block" />
        </div>
        <div className="draw-layout__aside">
          <div className="skeleton skeleton--block" style={{ height: 320 }} />
        </div>
      </div>
    </>
  );
}
