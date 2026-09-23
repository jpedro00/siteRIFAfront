import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Gift, Info, ShieldCheck } from 'lucide-react';
import {
  ApiClientError,
  formatCents,
  formatInteger,
  formatNumberLabel,
  labelDigitsForGridSize,
  type PublicDrawDetail,
} from '@campaigns/shared';
import { PrizeImage } from '../components/PrizeImage.tsx';
import { ProgressBar } from '../components/ProgressBar.tsx';
import { DrawStats } from '../components/DrawStats.tsx';
import { NumberGrid } from '../components/NumberGrid.tsx';
import { NumberSelectionBar } from '../components/NumberSelectionBar.tsx';
import { StatusBadge, isBuyable, statusMessage } from '../components/StatusBadge.tsx';
import { ErrorState, NotFoundState, mensagemPara } from '../components/States.tsx';
import { DetailSkeleton, NumberGridSkeleton } from '../components/Skeletons.tsx';
import { useApiResource } from '../hooks/useApiResource.ts';
import { saveReservation } from '../lib/reservationStore.ts';
import { api } from '../api.ts';
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

export function DrawPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [selecionados, setSelecionados] = useState<Set<number>>(() => new Set());
  const [reservando, setReservando] = useState(false);
  const [erroReserva, setErroReserva] = useState<string | null>(null);

  const sorteio = useApiResource<PublicDrawDetail>(
    (signal) => api.call('publicDraw', undefined, { params: { slug }, signal }),
    [slug],
  );

  const drawId = sorteio.data?.id ?? null;

  const numeros = useApiResource(
    (signal) =>
      drawId
        ? api.call('publicDrawNumbers', undefined, { params: { id: drawId }, signal })
        : Promise.resolve(null),
    [drawId],
  );

  const ocupados = useMemo(() => {
    const mapa = new Map<number, Exclude<CellState, 'LIVRE' | 'SELECIONADO'>>();
    for (const item of numeros.data?.taken ?? []) {
      mapa.set(item.number, item.status);
    }
    return mapa;
  }, [numeros.data]);

  const alternar = useCallback(
    (valor: number) => {
      setErroReserva(null);
      setSelecionados((anterior) => {
        const proximo = new Set(anterior);
        if (proximo.has(valor)) {
          proximo.delete(valor);
          return proximo;
        }
        if (proximo.size >= MAX_SELECAO) {
          setErroReserva(`Você pode escolher até ${MAX_SELECAO} números por compra.`);
          return anterior;
        }
        proximo.add(valor);
        return proximo;
      });
    },
    [],
  );

  const adicionarVarios = useCallback((valores: number[]) => {
    setErroReserva(null);
    setSelecionados((anterior) => {
      const proximo = new Set(anterior);
      for (const valor of valores) {
        if (proximo.size >= MAX_SELECAO) break;
        proximo.add(valor);
      }
      return proximo;
    });
  }, []);

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

      navigate(`/sorteio/${sorteio.data.slug}/checkout`, {
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
  }, [navigate, numeros, ordenados, sorteio.data]);

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
  const digitos = labelDigitsForGridSize(draw.totalNumbers);
  const disponiveis = Math.max(0, draw.totalNumbers - draw.takenCount);
  const totalSelecionado = ordenados.length * draw.unitPriceCents;
  const esgotado = disponiveis === 0;

  return (
    <div className="container page draw-page">
      <Link className="back-link" to="/sorteios">
        <ArrowLeft size={16} aria-hidden="true" />
        Todos os sorteios
      </Link>

      <div className="draw-layout">
        {/* ----------------------------------------------------------- */}
        <div className="draw-layout__main stack stack--lg">
          <PrizeImage url={draw.prizeImageUrl} alt={draw.prizeName} priority />

          <header className="stack stack--sm">
            <div className="row row--wrap">
              <StatusBadge status={draw.status} size="lg" />
            </div>
            <h1 className="draw-page__title">{draw.prizeName}</h1>
            <p className="draw-page__subtitle">{draw.title}</p>
          </header>

          {draw.description && (
            <section className="prose" aria-labelledby="sobre-sorteio">
              <h2 id="sobre-sorteio" className="prose__title">
                Sobre este sorteio
              </h2>
              <p>{draw.description}</p>
            </section>
          )}

          {draw.prizeDescription && (
            <section className="prose" aria-labelledby="sobre-premio">
              <h2 id="sobre-premio" className="prose__title">
                <Gift size={18} aria-hidden="true" />
                O prêmio
              </h2>
              <p>{draw.prizeDescription}</p>
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
                Ao reservar, seus números ficam bloqueados por <strong>30 minutos</strong> para
                você concluir a compra.
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
                Você pode escolher até <strong>{MAX_SELECAO} números</strong> por compra.
              </li>
            </ul>
          </section>
        </div>

        {/* ----------------------------------------------------------- */}
        <aside className="draw-layout__aside">
          <div className="buy-panel">
            <div className="buy-panel__price">
              <span className="buy-panel__price-label">Cada número por</span>
              <strong className="buy-panel__price-value">{formatCents(draw.unitPriceCents)}</strong>
            </div>

            <ProgressBar paid={draw.paidCount} total={draw.totalNumbers} />

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
              disabled={!vendendo || esgotado || ordenados.length === 0 || reservando}
              onClick={() => void reservar()}
            >
              {reservando ? <span className="btn__spinner" aria-hidden="true" /> : null}
              {reservando
                ? 'Reservando…'
                : ordenados.length === 0
                  ? 'Escolha seus números'
                  : `Reservar ${ordenados.length} ${ordenados.length === 1 ? 'número' : 'números'}`}
            </button>

            <p className="buy-panel__note">
              A reserva vale por 30 minutos. Você ainda vai informar seus dados antes de
              confirmar.
            </p>
          </div>
        </aside>
      </div>

      {/* --------------------------------------------------------------- */}
      <div className="draw-page__grid">
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
            maxSelection={MAX_SELECAO}
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
        disabled={!vendendo || esgotado}
      />
    </div>
  );
}
