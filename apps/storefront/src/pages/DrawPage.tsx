import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, FileText, Gift, Info, ShieldCheck, Trophy, WifiOff } from 'lucide-react';
import {
  ApiClientError,
  RESERVATION_TTL_MINUTES,
  formatCents,
  formatDateTime,
  formatInteger,
  formatNumberLabel,
  labelDigitsForGridSize,
  type PublicDrawDetail,
} from '@clubedarifa/shared';
import { PrizeGallery } from '../components/PrizeGallery.tsx';
import { SalesHint } from '../components/SalesHint.tsx';
import { PromoNote } from '../components/PromoNote.tsx';
import { ProgressBar } from '../components/ProgressBar.tsx';
import { DrawStats } from '../components/DrawStats.tsx';
import { NumberGrid } from '../components/NumberGrid.tsx';
import { NumberSelectionBar } from '../components/NumberSelectionBar.tsx';
import { StatusBadge, isBuyable, statusMessage } from '../components/StatusBadge.tsx';
import { ErrorState, NotFoundState, mensagemPara } from '../components/States.tsx';
import { DetailSkeleton, NumberGridSkeleton } from '../components/Skeletons.tsx';
import { useApiResource } from '../hooks/useApiResource.ts';
import { useApiPolling } from '../hooks/useApiPolling.ts';
import { useDocumentMeta } from '../hooks/useDocumentMeta.ts';
import { saveReservation } from '../lib/reservationStore.ts';
import { api } from '../api.ts';
import { useAppPaths } from '../state/MarketplaceScope.tsx';
import { accentStyle, imageSrc as imagem } from '../lib/brand.ts';
import { Countdown } from '../components/Countdown.tsx';
import { RecentBuyers } from '../components/RecentBuyers.tsx';
import type { CellState } from '../components/NumberCell.tsx';

/**
 * Pagina do sorteio: `/sorteio/:slug`.
 *
 * LAYOUT
 * ------
 * No desktop: coluna esquerda com premio, descricao e regras; coluna direita
 * com o painel de compra GRUDADO (sticky). O painel acompanha a rolagem
 * porque a grade e longa — sem isso, escolher o numero 940 significa rolar de
 * volta ao topo para ver quanto vai pagar.
 *
 * No celular nao existe coluna: o painel vira a barra fixa do rodape
 * (`NumberSelectionBar`), que so aparece quando ha numero escolhido.
 *
 * LIMITE DE SELECAO
 * -----------------
 * 100 por compra, igual ao `max(100)` do schema de reserva no servidor. O
 * limite e repetido aqui para dar uma mensagem util ANTES do envio, e nao
 * para substituir a validacao: quem decide continua sendo o backend.
 */
const MAX_SELECAO = 100;

/** Intervalo do polling da grade (a decisao ATUALIZACAO_GRADE: polling de 3 s com ETag). */
const INTERVALO_GRADE_MS = 3_000;

export function DrawPage() {
  const paths = useAppPaths();
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [selecionados, setSelecionados] = useState<Set<number>>(() => new Set());
  const [reservando, setReservando] = useState(false);
  const [erroReserva, setErroReserva] = useState<string | null>(null);
  const [avisoPerda, setAvisoPerda] = useState<string | null>(null);

  const sorteio = useApiResource<PublicDrawDetail>(
    (signal) => api.call('publicDraw', undefined, { params: { slug }, signal }),
    [slug],
  );

  const drawId = sorteio.data?.id ?? null;
  const limiteMax = Math.min(MAX_SELECAO, sorteio.data?.customization.maxPerOrder ?? MAX_SELECAO);
  const limiteMin = sorteio.data?.customization.minPerOrder ?? 1;

  useDocumentMeta({
    title: sorteio.data ? `${sorteio.data.prizeName} · ${sorteio.data.title}` : 'Sorteio',
    description: sorteio.data?.description ?? null,
    image: imagem(sorteio.data?.customization.bannerUrl ?? sorteio.data?.prizes[0]?.imageUrl ?? sorteio.data?.prizeImageUrl ?? null),
  });

  // A grade acompanha as OUTRAS pessoas: consulta a cada 3 s, revalidando com o ETag da
  // API (nada mudou = 304, sem corpo). So re-renderiza quando o conteudo muda; a aba
  // escondida pausa; falha de rede mantem a ultima grade e mostra o aviso "sem conexao".
  const numeros = useApiPolling(
    (signal) =>
      drawId
        ? api.call('publicDrawNumbers', undefined, {
            params: { id: drawId },
            signal,
            revalidate: true,
          })
        : Promise.resolve(null),
    [drawId],
    { intervalMs: INTERVALO_GRADE_MS, enabled: drawId !== null },
  );

  const ocupados = useMemo(() => {
    const mapa = new Map<number, Exclude<CellState, 'LIVRE' | 'SELECIONADO'>>();
    for (const item of numeros.data?.taken ?? []) {
      mapa.set(item.number, item.status);
    }
    return mapa;
  }, [numeros.data]);

  /**
   * Numero que eu escolhi e OUTRA pessoa pegou enquanto eu olhava a grade: sai da minha
   * selecao e a pessoa e AVISADA, com o rotulo do numero. Deixar o numero selecionado ate
   * o servidor recusar a reserva descobriria o problema no pior momento — depois do
   * clique em "Reservar".
   */
  const selecionadosRef = useRef(selecionados);
  selecionadosRef.current = selecionados;
  const digitosRef = useRef<2 | 3>(2);
  digitosRef.current = sorteio.data ? labelDigitsForGridSize(sorteio.data.totalNumbers) : 2;

  useEffect(() => {
    if (ocupados.size === 0) return;
    const perdidos = [...selecionadosRef.current].filter((n) => ocupados.has(n));
    if (perdidos.length === 0) return;

    setSelecionados((anterior) => {
      const proximo = new Set(anterior);
      for (const n of perdidos) proximo.delete(n);
      return proximo;
    });
    const rotulos = perdidos.map((n) => formatNumberLabel(n, digitosRef.current)).join(', ');
    setAvisoPerda(
      perdidos.length === 1
        ? `O número ${rotulos} acabou de ser reservado por outra pessoa e saiu da sua seleção.`
        : `Os números ${rotulos} acabaram de ser reservados por outras pessoas e saíram da sua seleção.`,
    );
  }, [ocupados]);

  const alternar = useCallback(
    (valor: number) => {
      setErroReserva(null);
      setAvisoPerda(null);
      setSelecionados((anterior) => {
        const proximo = new Set(anterior);
        if (proximo.has(valor)) {
          proximo.delete(valor);
          return proximo;
        }
        if (proximo.size >= limiteMax) {
          setErroReserva(`Você pode escolher até ${limiteMax} números por compra.`);
          return anterior;
        }
        proximo.add(valor);
        return proximo;
      });
    },
    [limiteMax],
  );

  const adicionarVarios = useCallback((valores: number[]) => {
    setErroReserva(null);
    setSelecionados((anterior) => {
      const proximo = new Set(anterior);
      for (const valor of valores) {
        if (proximo.size >= limiteMax) break;
        proximo.add(valor);
      }
      return proximo;
    });
  }, [limiteMax]);

  const limpar = useCallback(() => {
    setErroReserva(null);
    setSelecionados(new Set());
  }, []);

  const ordenados = useMemo(
    () => [...selecionados].sort((a, b) => a - b),
    [selecionados],
  );

  const reservar = useCallback(async () => {
    if (!sorteio.data || ordenados.length === 0) return;
    if (ordenados.length < limiteMin) {
      setErroReserva(`Escolha ao menos ${limiteMin} números neste sorteio.`);
      return;
    }

    setReservando(true);
    setErroReserva(null);

    try {
      const reserva = await api.call(
        'createReservation',
        { numbers: ordenados },
        { params: { id: sorteio.data.id } },
      );

      saveReservation({
        reservation: reserva,
        drawSlug: sorteio.data.slug,
        drawTitle: sorteio.data.title,
        labelDigits: labelDigitsForGridSize(sorteio.data.totalNumbers),
      });

      navigate(paths.checkout(sorteio.data.slug), {
        state: { reservationId: reserva.reservationId },
      });
    } catch (falha) {
      // 409 traz os numeros que escaparam. Dizer QUAIS — e tira-los da
      // selecao — e a diferenca entre "alguem foi mais rapido, escolha
      // outros" e um erro que obriga a comecar do zero.
      if (falha instanceof ApiClientError && falha.code === 'CONFLICT') {
        const detalhes = falha.details as { unavailableNumbers?: number[] } | undefined;
        const perdidos = detalhes?.unavailableNumbers ?? [];
        const digitos = labelDigitsForGridSize(sorteio.data.totalNumbers);

        if (perdidos.length > 0) {
          setSelecionados((anterior) => {
            const proximo = new Set(anterior);
            for (const valor of perdidos) proximo.delete(valor);
            return proximo;
          });
          setErroReserva(
            `${perdidos.length === 1 ? 'O número' : 'Os números'} ${perdidos
              .map((n) => formatNumberLabel(n, digitos))
              .join(', ')} ${perdidos.length === 1 ? 'acabou de ser reservado' : 'acabaram de ser reservados'} por outra pessoa. Removemos da sua seleção — escolha ${perdidos.length === 1 ? 'outro' : 'outros'} para continuar.`,
          );
        } else {
          setErroReserva(mensagemPara(falha));
        }
        numeros.reload();
      } else {
        setErroReserva(mensagemPara(falha));
      }
    } finally {
      setReservando(false);
    }
  }, [limiteMin, navigate, numeros, ordenados, paths, sorteio.data]);

  // -------------------------------------------------------------------------
  if (sorteio.status === 'loading') {
    return (
      <div className="container page">
        <DetailSkeleton />
      </div>
    );
  }

  if (sorteio.status === 'error') {
    const naoExiste =
      sorteio.error instanceof ApiClientError && sorteio.error.code === 'NOT_FOUND';

    return (
      <div className="container page">
        {naoExiste ? (
          <NotFoundState
            title="Sorteio não encontrado"
            message="Este sorteio não existe ou não está mais disponível."
            action={
              <Link className="btn btn--primary" to="/sorteios">
                Ver outros sorteios
              </Link>
            }
          />
        ) : (
          <ErrorState error={sorteio.error} onRetry={sorteio.reload} />
        )}
      </div>
    );
  }

  const draw = sorteio.data!;
  const vendendo = isBuyable(draw.status);
  const comResultado = draw.status === 'RESULTADO PUBLICADO';
  const digitos = labelDigitsForGridSize(draw.totalNumbers);
  const disponiveis = Math.max(0, draw.totalNumbers - draw.takenCount);
  const totalSelecionado = ordenados.length * draw.unitPriceCents;
  const esgotado = disponiveis === 0;

  return (
    <div className="container page draw-page" style={accentStyle(draw.customization.accentColor)}>
      <Link className="back-link" to="/sorteios">
        <ArrowLeft size={16} aria-hidden="true" />
        Todos os sorteios
      </Link>

      <div className="draw-layout">
        {/* ----------------------------------------------------------- */}
        <div className="draw-layout__main stack stack--lg">
          {imagem(draw.customization.bannerUrl) && (
            <img className="draw-banner" src={imagem(draw.customization.bannerUrl)!} alt="" />
          )}
          <PrizeGallery prizes={draw.prizes} fallbackName={draw.prizeName} />

          <header className="stack stack--sm">
            <div className="row row--wrap">
              <StatusBadge status={draw.status} size="lg" />
            </div>
            {draw.category && <p className="draw-page__kicker">{draw.category}</p>}
            <h1 className="draw-page__title">{draw.prizeName}</h1>
            <p className="draw-page__subtitle">{draw.title}</p>
            {draw.subtitle && <p className="draw-page__tagline">{draw.subtitle}</p>}
            {draw.customization.headline && (
              <p className="draw-page__headline">{draw.customization.headline}</p>
            )}
          </header>

          {comResultado && (
            <Link className="alert alert--success result-banner" to={paths.result(draw.slug)}>
              <Trophy className="alert__icon" size={18} aria-hidden="true" />
              <span className="alert__body">
                <strong>O resultado foi publicado.</strong> Veja o número contemplado e como ele foi
                apurado.
              </span>
            </Link>
          )}

          {/* RN29: regulamento, preco total e prazo da reserva ficam SEMPRE visiveis. O
              regulamento e o texto proprio do sorteio; sorteios antigos, sem ele, mostram a
              descricao. */}
          {draw.customization.showBuyers && <RecentBuyers slug={draw.slug} />}

          <section className="prose" aria-labelledby="regulamento" id="regulamento">
            <h2 id="regulamento-titulo" className="prose__title">
              <FileText size={18} aria-hidden="true" />
              Regulamento
            </h2>
            {(draw.regulation ?? draw.description) ? (
              <p className="prose__pre">{draw.regulation ?? draw.description}</p>
            ) : (
              <p className="muted">A organização ainda não publicou o texto do regulamento.</p>
            )}
            <ul className="rules rules--dates">
              {draw.salesStartAt && (
                <li>
                  <CalendarDays size={14} aria-hidden="true" /> Vendas a partir de{' '}
                  <strong>{formatDateTime(draw.salesStartAt)}</strong>
                </li>
              )}
              {draw.closeAt && (
                <li>
                  <CalendarDays size={14} aria-hidden="true" /> Vendas encerram em{' '}
                  <strong>{formatDateTime(draw.closeAt)}</strong>
                  {draw.closeMode === 'O_QUE_VIER_PRIMEIRO' ? ' (ou antes, se esgotar)' : ''}
                </li>
              )}
              {draw.drawDate && (
                <li>
                  <CalendarDays size={14} aria-hidden="true" /> Apuração pela Loteria Federal em{' '}
                  <strong>{formatDateTime(draw.drawDate)}</strong>
                </li>
              )}
            </ul>
          </section>

          {draw.regulation && draw.description && (
            <section className="prose" aria-labelledby="sobre-sorteio">
              <h2 id="sobre-sorteio" className="prose__title">
                <FileText size={18} aria-hidden="true" />
                Sobre o sorteio
              </h2>
              <p className="prose__pre">{draw.description}</p>
            </section>
          )}

          {(draw.prizeDescription || draw.prizes.length > 1 || draw.prizes.some((p) => p.estimatedValueCents)) && (
            <section className="prose" aria-labelledby="sobre-premio">
              <h2 id="sobre-premio" className="prose__title">
                <Gift size={18} aria-hidden="true" />
                {draw.prizes.length > 1 ? 'Os prêmios' : 'O prêmio'}
              </h2>
              {draw.prizeDescription && draw.prizes.length <= 1 && <p>{draw.prizeDescription}</p>}
              {(draw.prizes.length > 1 || draw.prizes.some((p) => p.estimatedValueCents)) && (
                <ol className="prize-ranking">
                  {draw.prizes.map((p) => (
                    <li key={p.position}>
                      <strong>{p.position}º</strong> {p.name}
                      {p.estimatedValueCents ? (
                        <span className="muted"> · valor estimado {formatCents(p.estimatedValueCents)}</span>
                      ) : null}
                      {p.description && <span className="prize-ranking__desc">{p.description}</span>}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}

          <DrawStats draw={draw} />

          <section className="prose" aria-labelledby="regras">
            <h2 id="regras" className="prose__title">
              <ShieldCheck size={18} aria-hidden="true" />
              Como funciona
            </h2>
            <ul className="rules">
              <li>
                Ao reservar, seus números ficam bloqueados por{' '}
                <strong>{RESERVATION_TTL_MINUTES} minutos</strong> para você concluir a compra.
              </li>
              <li>
                Passado esse prazo sem pagamento, os números voltam a ficar disponíveis para
                outras pessoas.
              </li>
              <li>
                Cada número pertence a uma única pessoa. Um número já pago não volta a ser
                vendido.
              </li>
              <li>
                Você pode escolher até <strong>{limiteMax} números</strong> por compra.
              </li>
              {limiteMin > 1 && (
                <li>
                  A compra mínima é de <strong>{limiteMin} números</strong>.
                </li>
              )}
            </ul>
          </section>
        </div>

        {/* ----------------------------------------------------------- */}
        <aside className="draw-layout__aside">
          <div className="buy-panel">
            {draw.customization.showCountdown && vendendo && draw.closeAt && <Countdown until={draw.closeAt} />}
            <div className="buy-panel__price">
              <span className="buy-panel__price-label">Cada número por</span>
              <strong className="buy-panel__price-value">{formatCents(draw.unitPriceCents)}</strong>
              <PromoNote draw={draw} />
            </div>

            {draw.customization.progressMode !== 'OCULTAR' && (
              <ProgressBar paid={draw.paidCount} total={draw.totalNumbers} />
            )}
            {draw.customization.progressMode === 'FALTAM' && (
              <SalesHint
                total={draw.totalNumbers}
                paid={draw.paidCount}
                drawDate={draw.drawDate}
              />
            )}

            <dl className="buy-panel__lines">
              <div className="buy-panel__line">
                <dt>Disponíveis</dt>
                <dd>
                  {formatInteger(disponiveis)} de {formatInteger(draw.totalNumbers)}
                </dd>
              </div>
              <div className="buy-panel__line">
                <dt>Selecionados</dt>
                <dd>{ordenados.length}</dd>
              </div>
              <div className="buy-panel__line buy-panel__line--total">
                <dt>Total</dt>
                <dd>{formatCents(totalSelecionado)}</dd>
              </div>
            </dl>

            {ordenados.length > 0 && (
              <ul className="chip-list chip-list--panel">
                {ordenados.map((valor) => (
                  <li key={valor}>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => alternar(valor)}
                      aria-label={`Remover número ${formatNumberLabel(valor, digitos)}`}
                    >
                      {formatNumberLabel(valor, digitos)}
                      <span aria-hidden="true">×</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {erroReserva && (
              <p className="alert alert--warning" role="alert">
                <Info className="alert__icon" size={16} aria-hidden="true" />
                <span className="alert__body">{erroReserva}</span>
              </p>
            )}

            {!vendendo && (
              <p className="alert alert--info" role="status">
                <Info className="alert__icon" size={16} aria-hidden="true" />
                <span className="alert__body">
                  {statusMessage(draw.status)}. Não é possível comprar números neste momento.
                </span>
              </p>
            )}

            {vendendo && esgotado && (
              <p className="alert alert--info" role="status">
                <Info className="alert__icon" size={16} aria-hidden="true" />
                <span className="alert__body">Todos os números deste sorteio já foram vendidos.</span>
              </p>
            )}

            <button
              type="button"
              className="btn btn--primary btn--lg btn--block"
              disabled={!vendendo || esgotado || ordenados.length < Math.max(1, limiteMin) || reservando}
              onClick={() => void reservar()}
            >
              {reservando ? <span className="btn__spinner" aria-hidden="true" /> : null}
              {reservando
                ? 'Reservando…'
                : ordenados.length === 0
                  ? 'Escolha seus números'
                  : ordenados.length < limiteMin
                    ? `Escolha ao menos ${limiteMin} números`
                    : draw.customization.ctaLabel
                    ? `${draw.customization.ctaLabel} (${ordenados.length})`
                    : `Reservar ${ordenados.length} ${ordenados.length === 1 ? 'número' : 'números'}`}
            </button>

            <p className="buy-panel__note">
              A reserva vale por {RESERVATION_TTL_MINUTES} minutos e você paga com PIX. Ao reservar
              você concorda com o{' '}
              <a href="#regulamento-titulo">regulamento</a>.
            </p>
          </div>
        </aside>
      </div>

      {/* --------------------------------------------------------------- */}
      <div className="draw-page__grid">
        {avisoPerda && (
          <p className="alert alert--warning" role="alert">
            <Info className="alert__icon" size={16} aria-hidden="true" />
            <span className="alert__body">{avisoPerda}</span>
          </p>
        )}
        {numeros.stale && (
          <p className="alert alert--warning" role="status">
            <WifiOff className="alert__icon" size={16} aria-hidden="true" />
            <span className="alert__body">
              Sem conexão. A grade pode estar desatualizada — tentando de novo.
            </span>
          </p>
        )}
        {numeros.status === 'loading' && <NumberGridSkeleton />}

        {numeros.status === 'error' && (
          <ErrorState
            error={numeros.error}
            onRetry={numeros.reload}
            title="Não foi possível carregar os números"
          />
        )}

        {numeros.status === 'ready' && numeros.data && (
          <NumberGrid
            totalNumbers={numeros.data.totalNumbers}
            labelDigits={numeros.data.labelDigits}
            taken={ocupados}
            selected={selecionados}
            onToggle={alternar}
            onSelectMany={adicionarVarios}
            onClear={limpar}
            maxSelection={limiteMax}
            disabled={!vendendo}
          />
        )}
      </div>

      <NumberSelectionBar
        selected={ordenados}
        labelDigits={digitos}
        unitPriceCents={draw.unitPriceCents}
        onRemove={alternar}
        onClear={limpar}
        onSubmit={() => void reservar()}
        submitting={reservando}
        disabled={!vendendo || esgotado || ordenados.length < limiteMin}
      />
    </div>
  );
}
