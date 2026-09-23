import { Link } from 'react-router-dom';
import { CheckCircle2, CreditCard, MousePointerClick, ShieldCheck, Trophy } from 'lucide-react';
import { isBuyable } from '../components/StatusBadge.tsx';
import { DrawCard } from '../components/DrawCard.tsx';
import { DrawHero } from '../components/DrawHero.tsx';
import { EmptyDrawState } from '../components/EmptyDrawState.tsx';
import { ErrorState } from '../components/States.tsx';
import { DrawCardSkeleton, HeroSkeleton } from '../components/Skeletons.tsx';
import { useApiResource } from '../hooks/useApiResource.ts';
import { useStorefront } from '../state/SessionProvider.tsx';
import { api } from '../api.ts';

/**
 * Home comercial.
 *
 * A ordem da pagina e uma decisao de venda, nao de arquitetura: premio,
 * preco, acao — depois os outros sorteios, depois como funciona, depois a
 * comunidade. Texto institucional no topo empurra o produto para baixo da
 * dobra justamente no celular, que e onde a maioria chega.
 *
 * O destaque e o primeiro sorteio COM VENDAS ABERTAS. Um sorteio pausado no
 * topo, com botao que nao leva a lugar nenhum, gasta a melhor area da tela.
 */
export function HomePage() {
  const { tenant } = useStorefront();
  const nomeComunidade = tenant?.publicName ?? tenant?.name ?? 'esta comunidade';

  const sorteios = useApiResource(
    (signal) => api.call('publicDraws', undefined, { signal }),
    [],
  );

  if (sorteios.status === 'loading') {
    return (
      <div className="container stack stack--xl home">
        <HeroSkeleton />
        <DrawCardSkeleton />
      </div>
    );
  }

  if (sorteios.status === 'error') {
    return (
      <div className="container">
        <ErrorState error={sorteios.error} onRetry={sorteios.reload} />
      </div>
    );
  }

  const lista = sorteios.data?.draws ?? [];
  const destaque = lista.find((draw) => isBuyable(draw.status)) ?? lista[0] ?? null;
  const demais = destaque ? lista.filter((draw) => draw.id !== destaque.id) : [];

  return (
    <div className="home">
      {destaque ? (
        <div className="container">
          <DrawHero draw={destaque} />
        </div>
      ) : (
        <div className="container">
          <EmptyDrawState communityName={nomeComunidade} />
        </div>
      )}

      {demais.length > 0 && (
        <section className="container home__section" aria-labelledby="outros-sorteios">
          <div className="section__head">
            <h2 id="outros-sorteios" className="home__section-title">
              Outros sorteios
            </h2>
            <Link className="btn btn--ghost btn--sm" to="/sorteios">
              Ver todos
            </Link>
          </div>
          <div className="draw-list">
            {demais.slice(0, 6).map((draw) => (
              <DrawCard key={draw.id} draw={draw} />
            ))}
          </div>
        </section>
      )}

      {/*
        "Como participar" so faz sentido quando ha algo para participar. Sem
        sorteio aberto, o passo a passo vira instrucao para uma acao que nao
        existe.
      */}
      {destaque && (
        <section className="container home__section" aria-labelledby="como-participar">
          <div className="section__head">
            <h2 id="como-participar" className="home__section-title">
              Como participar
            </h2>
          </div>
          <ol className="steps">
            {[
              {
                Icone: MousePointerClick,
                titulo: 'Escolha seus números',
                texto: 'Selecione um a um ou deixe o sistema sortear para você.',
              },
              {
                Icone: ShieldCheck,
                titulo: 'Reserve por 30 minutos',
                texto: 'Os números ficam bloqueados para mais ninguém enquanto você conclui.',
              },
              {
                // NAO prometer "confirme o pagamento": nao existe pagamento no
                // produto. Descrever um passo que a tela seguinte nao oferece e
                // a forma mais rapida de perder a confianca de quem chegou ate
                // aqui. O texto cobre o que o checkout REALMENTE faz hoje —
                // identificar quem comprou e registrar o pedido.
                Icone: CreditCard,
                titulo: 'Registre seu pedido',
                texto: 'Informe seus dados de contato para o pedido ficar no seu nome.',
              },
              {
                Icone: Trophy,
                titulo: 'Acompanhe o sorteio',
                texto: 'Você recebe o comprovante com seus números na hora.',
              },
            ].map(({ Icone, titulo, texto }, indice) => (
              <li key={titulo} className="step">
                <span className="step__icon" aria-hidden="true">
                  <Icone size={20} />
                </span>
                <span className="step__number" aria-hidden="true">
                  {indice + 1}
                </span>
                <h3 className="step__title">{titulo}</h3>
                <p className="step__text">{texto}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="container home__section" aria-labelledby="sobre-comunidade">
        <div className="community">
          <div className="community__text">
            <p className="eyebrow">A comunidade</p>
            <h2 id="sobre-comunidade" className="community__title">
              {nomeComunidade}
            </h2>
            <p className="community__description">
              Todos os sorteios desta página são organizados por {nomeComunidade}. Cada número
              vendido é único e registrado no momento da compra.
            </p>
            <ul className="community__points">
              <li>
                <CheckCircle2 size={16} aria-hidden="true" />
                Um número não pode ser vendido duas vezes
              </li>
              <li>
                <CheckCircle2 size={16} aria-hidden="true" />
                Reserva com prazo claro antes do pagamento
              </li>
              <li>
                <CheckCircle2 size={16} aria-hidden="true" />
                Comprovante com seus números logo após a confirmação
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
