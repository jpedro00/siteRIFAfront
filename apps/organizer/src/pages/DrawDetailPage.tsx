import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeDollarSign,
  CalendarDays,
  ExternalLink,
  Hash,
  Pause,
  Play,
  Square,
  Ticket,
  Timer,
} from 'lucide-react';
import {
  ApiClientError,
  formatCents,
  formatCentsCompact,
  formatDateTime,
  formatInteger,
  formatNumberLabel,
  percentOf,
  storefrontDrawUrl,
  type DrawStatusPhase2,
  type OrganizerDraw,
} from '@campaigns/shared';
import { ErrorPanel, MetricCard, MetricsSkeleton, PageHeader, StatusBadge } from '../components/Ui.tsx';
import { useApiResource } from '../hooks/useApiResource.ts';
import { useSession } from '../state/SessionProvider.tsx';
import { api } from '../api.ts';

/**
 * Detalhe do sorteio: `/sorteios/:id`.
 *
 * TRANSICOES
 * ----------
 * Os botoes espelham a maquina de estados do servico — RASCUNHO abre;
 * ATIVA pausa ou encerra; PAUSADA reabre ou encerra; ENCERRADA nao volta. A
 * lista aqui evita oferecer um caminho que a API vai recusar, mas quem decide
 * continua sendo o backend: esconder botao nao e regra de negocio.
 *
 * Encerrar vendas e IRREVERSIVEL, entao pede confirmacao. A confirmacao e um
 * painel na propria tela, nao `window.confirm` — o dialogo nativo nao recebe
 * estilo, nao explica a consequencia e trava a aba.
 */
const ACOES: Record<
  DrawStatusPhase2,
  { status: 'ATIVA' | 'PAUSADA' | 'VENDAS ENCERRADAS'; rotulo: string; icone: typeof Play; variante: string }[]
> = {
  RASCUNHO: [
    { status: 'ATIVA', rotulo: 'Abrir vendas', icone: Play, variante: 'btn--primary' },
  ],
  ATIVA: [
    { status: 'PAUSADA', rotulo: 'Pausar vendas', icone: Pause, variante: 'btn--secondary' },
    {
      status: 'VENDAS ENCERRADAS',
      rotulo: 'Encerrar vendas',
      icone: Square,
      variante: 'btn--danger-ghost',
    },
  ],
  PAUSADA: [
    { status: 'ATIVA', rotulo: 'Retomar vendas', icone: Play, variante: 'btn--primary' },
    {
      status: 'VENDAS ENCERRADAS',
      rotulo: 'Encerrar vendas',
      icone: Square,
      variante: 'btn--danger-ghost',
    },
  ],
  'VENDAS ENCERRADAS': [],
};

export function DrawDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { can } = useSession();

  const [alterando, setAlterando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const sorteio = useApiResource<OrganizerDraw>(
    (signal) => api.call('organizerDraw', undefined, { params: { id }, signal }),
    [id],
  );

  const numeros = useApiResource(
    (signal) =>
      sorteio.data
        ? api.call('publicDrawNumbers', undefined, { params: { id }, signal })
        : Promise.resolve(null),
    [id, sorteio.data?.id],
  );

  const mudarStatus = useCallback(
    async (status: 'ATIVA' | 'PAUSADA' | 'VENDAS ENCERRADAS') => {
      setAlterando(true);
      setErroAcao(null);
      try {
        await api.call('updateDrawStatus', { status }, { params: { id } });
        setConfirmando(false);
        sorteio.reload();
        numeros.reload();
      } catch (falha) {
        setErroAcao(
          falha instanceof ApiClientError
            ? falha.message
            : 'Não foi possível alterar a situação do sorteio.',
        );
      } finally {
        setAlterando(false);
      }
    },
    [id, numeros, sorteio],
  );

  if (sorteio.status === 'loading') {
    return (
      <>
        <PageHeader title="Carregando…" />
        <MetricsSkeleton />
      </>
    );
  }

  if (sorteio.status === 'error') {
    return <ErrorPanel error={sorteio.error} onRetry={sorteio.reload} />;
  }

  const draw = sorteio.data!;
  const percentual = percentOf(draw.paidCount, draw.totalNumbers);
  const disponiveis = Math.max(0, draw.totalNumbers - draw.takenCount);
  const dataSorteio = formatDateTime(draw.drawDate);
  const acoes = can('draw:lifecycle:write') ? ACOES[draw.status] : [];

  // A base da vitrine e CONFIGURACAO, nao codigo: cada instalacao tem o
  // proprio dominio. A montagem e validacao moram em `@campaigns/shared` e
  // tem teste proprio.
  const urlVitrine = storefrontDrawUrl(
    import.meta.env['VITE_STOREFRONT_BASE_URL'] as string | undefined,
    draw.slug,
  );

  return (
    <>
      <Link className="back-link" to="/sorteios">
        <ArrowLeft size={16} aria-hidden="true" />
        Sorteios
      </Link>

      <PageHeader
        title={draw.title}
        description={draw.prizeName}
        badge={<StatusBadge status={draw.status} />}
        actions={
          <>
            {acoes.map((acao) => {
              const Icone = acao.icone;
              const encerrar = acao.status === 'VENDAS ENCERRADAS';
              return (
                <button
                  key={acao.status}
                  type="button"
                  className={`btn ${acao.variante}`}
                  disabled={alterando}
                  onClick={() => {
                    if (encerrar) {
                      setConfirmando(true);
                      return;
                    }
                    void mudarStatus(acao.status);
                  }}
                >
                  <Icone size={16} aria-hidden="true" />
                  {acao.rotulo}
                </button>
              );
            })}
            {/*
              O link so existe quando ha para onde apontar.

              `urlVitrine` e `null` quando VITE_STOREFRONT_BASE_URL nao esta
              configurada — e ai o botao SOME, em vez de virar um endereco
              quebrado. Nao ha queda para `localhost`: isso funcionaria na
              maquina de quem desenvolve e morreria no cliente, que e o pior
              jeito de falhar, porque passa pelo teste manual.

              Rascunho tambem nao mostra: ele nao esta publicado.
            */}
            {draw.status !== 'RASCUNHO' && urlVitrine !== null && (
              <a
                className="btn btn--ghost"
                href={urlVitrine}
                // Outro dominio: abre em aba nova e sem passar o referenciador
                // nem a referencia `window.opener`.
                target="_blank"
                rel="noreferrer noopener"
              >
                <ExternalLink size={16} aria-hidden="true" />
                Ver na vitrine
              </a>
            )}
          </>
        }
      />

      {confirmando && (
        <div className="alert alert--warning" role="alertdialog" aria-labelledby="confirmar-titulo">
          <div className="alert__body stack stack--sm">
            <p className="alert__title" id="confirmar-titulo">
              Encerrar as vendas deste sorteio?
            </p>
            <p>
              Nenhum número poderá ser vendido depois disso, e esta ação não pode ser desfeita.
              Os números já pagos continuam válidos.
            </p>
            <div className="row">
              <button
                type="button"
                className="btn btn--danger btn--sm"
                disabled={alterando}
                onClick={() => void mudarStatus('VENDAS ENCERRADAS')}
              >
                {alterando ? <span className="btn__spinner" aria-hidden="true" /> : null}
                Encerrar vendas
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setConfirmando(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {erroAcao && (
        <div className="alert alert--danger" role="alert">
          <div className="alert__body">{erroAcao}</div>
        </div>
      )}

      <div className="metrics">
        <MetricCard
          label="Números pagos"
          value={`${formatInteger(draw.paidCount)} / ${formatInteger(draw.totalNumbers)}`}
          hint={`${percentual}% da grade vendida`}
          icon={<Ticket size={17} aria-hidden="true" />}
          tone="success"
        />
        <MetricCard
          label="Reservados"
          value={formatInteger(draw.reservedCount)}
          hint="Reservas dentro do prazo de 30 minutos"
          icon={<Timer size={17} aria-hidden="true" />}
          tone="warning"
        />
        <MetricCard
          label="Aguardando pagamento"
          value={formatInteger(draw.pendingCount)}
          hint="Pedidos feitos, pagamento não confirmado"
          icon={<Hash size={17} aria-hidden="true" />}
          tone="neutral"
        />
        <MetricCard
          label="Arrecadação"
          value={formatCentsCompact(draw.revenueCents)}
          hint="Somente pedidos pagos"
          icon={<BadgeDollarSign size={17} aria-hidden="true" />}
          tone="success"
        />
      </div>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Andamento das vendas</h2>
          <span className="section__hint">
            {formatInteger(disponiveis)} números ainda disponíveis
          </span>
        </div>

        <div className="card">
          <div className="card__body stack">
            <div className="progress progress--lg">
              <div
                className="progress__track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={draw.totalNumbers}
                aria-valuenow={draw.paidCount}
                aria-valuetext={`${formatInteger(draw.paidCount)} de ${formatInteger(draw.totalNumbers)} vendidos`}
              >
                <div
                  className={`progress__fill${percentual >= 100 ? ' progress__fill--success' : ''}`}
                  style={{ width: `${percentual}%` }}
                />
              </div>
              <div className="progress__meta">
                <span>
                  <span className="progress__value">{percentual}%</span> vendido
                </span>
                <span>
                  <span className="progress__value">{formatInteger(disponiveis)}</span> disponíveis
                </span>
              </div>
            </div>

            <dl className="detail-list">
              <div className="detail-list__row">
                <dt>Valor por número</dt>
                <dd>{formatCents(draw.unitPriceCents)}</dd>
              </div>
              <div className="detail-list__row">
                <dt>Tamanho da grade</dt>
                <dd>{formatInteger(draw.totalNumbers)} números</dd>
              </div>
              <div className="detail-list__row">
                <dt>Endereço na vitrine</dt>
                <dd>
                  <code>/sorteio/{draw.slug}</code>
                </dd>
              </div>
              <div className="detail-list__row">
                <dt>
                  <CalendarDays size={14} aria-hidden="true" /> Data do sorteio
                </dt>
                <dd>{dataSorteio ?? <span className="subtle">Não definida</span>}</dd>
              </div>
              <div className="detail-list__row">
                <dt>Criado em</dt>
                <dd>{formatDateTime(draw.createdAt)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {draw.description && (
        <section className="section">
          <div className="section__head">
            <h2 className="section__title">Descrição</h2>
          </div>
          <div className="card">
            <div className="card__body">
              <p className="detail-text">{draw.description}</p>
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Números ocupados</h2>
          <span className="section__hint">
            Reservados, aguardando pagamento e pagos
          </span>
        </div>

        {numeros.status === 'loading' && (
          <div className="card">
            <div className="card__body">
              <span className="skeleton skeleton--block" style={{ display: 'block' }} />
            </div>
          </div>
        )}

        {numeros.status === 'error' && (
          <ErrorPanel
            error={numeros.error}
            onRetry={numeros.reload}
            title="Não foi possível carregar os números"
          />
        )}

        {numeros.status === 'ready' && numeros.data && (
          <div className="card">
            <div className="card__body">
              {numeros.data.taken.length === 0 ? (
                <p className="muted">
                  Nenhum número foi reservado ou vendido ainda.
                </p>
              ) : (
                <>
                  <ul className="legend" style={{ marginBottom: 16 }}>
                    <li className="legend__item">
                      <span className="legend__swatch is-reserved" aria-hidden="true" />
                      Reservado
                    </li>
                    <li className="legend__item">
                      <span className="legend__swatch is-pending" aria-hidden="true" />
                      Aguardando pagamento
                    </li>
                    <li className="legend__item">
                      <span className="legend__swatch is-paid" aria-hidden="true" />
                      Pago
                    </li>
                  </ul>

                  <ul className="taken-list">
                    {numeros.data.taken.map((item) => (
                      <li
                        key={item.number}
                        className={`taken-number is-${item.status.toLowerCase()}`}
                      >
                        <span className="sr-only">
                          {item.status === 'PAGO'
                            ? 'Pago: '
                            : item.status === 'PENDENTE'
                              ? 'Aguardando pagamento: '
                              : 'Reservado: '}
                        </span>
                        {formatNumberLabel(item.number, numeros.data!.labelDigits)}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
