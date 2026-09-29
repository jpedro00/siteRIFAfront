import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, RefreshCw, Undo2 } from 'lucide-react';
import {
  ApiClientError,
  formatCents,
  formatDate,
  type PlatformReviewDecision,
  type ReviewQueueItem,
  type ReviewQueueResponse,
} from '@clubedarifa/shared';
import { api } from '../api.ts';
import { useSession } from '../state/SessionProvider.tsx';
import { ErrorState } from '../components/States.tsx';

/**
 * Fila de revisão de compliance. DOC-01 seção 7 · RN02.
 *
 * Todo sorteio sai de RASCUNHO para REVISÃO COMPLIANCE, e é AQUI que alguém da
 * plataforma decide: aprovar para vender agora (ATIVA), aprovar para vender
 * depois (AGENDADA) ou devolver ao organizador (RASCUNHO) — e devolver exige
 * dizer o que corrigir.
 *
 * Os botões só aparecem para `platform:review:decide`; o backend recusa a rota
 * de qualquer forma. Esconder é conveniência, não controle de acesso.
 */
export function ReviewQueuePage() {
  const { can } = useSession();
  const [data, setData] = useState<ReviewQueueResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .call('platformReviewQueue')
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const draws = data?.draws ?? [];
  const podeDecidir = can('platform:review:decide');

  return (
    <>
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Fila de revisão</h1>
          <p className="page-header__description">
            Sorteios enviados pelos organizadores e aguardando decisão da plataforma.
          </p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn--secondary" onClick={load} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" />
            Atualizar
          </button>
        </div>
      </header>

      {loading && (
        <p className="state state--loading" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" /> Carregando a fila…
        </p>
      )}

      {!loading && error != null && <ErrorState error={error} onRetry={load} />}

      {!loading && error == null && draws.length === 0 && (
        <div className="empty-state">
          <span className="empty-state__icon">
            <ClipboardCheck size={26} aria-hidden="true" />
          </span>
          <h2 className="empty-state__title">Nenhum sorteio aguardando revisão</h2>
          <p className="empty-state__text">
            Quando um organizador enviar um sorteio, ele aparece aqui.
          </p>
        </div>
      )}

      {!loading && error == null && draws.length > 0 && (
        <ul className="stack" aria-label="Sorteios aguardando revisão">
          {draws.map((draw) => (
            <ReviewCard key={draw.id} draw={draw} podeDecidir={podeDecidir} onDecided={load} />
          ))}
        </ul>
      )}
    </>
  );
}

function ReviewCard({
  draw,
  podeDecidir,
  onDecided,
}: {
  draw: ReviewQueueItem;
  podeDecidir: boolean;
  onDecided: () => void;
}) {
  const [reprovando, setReprovando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const decidir = useCallback(
    async (to: PlatformReviewDecision, reason?: string) => {
      setEnviando(true);
      setErro(null);
      try {
        await api.call(
          'platformReviewDecide',
          reason === undefined ? { to } : { to, reason },
          { params: { id: draw.id } },
        );
        onDecided();
      } catch (falha) {
        setErro(
          falha instanceof ApiClientError
            ? falha.message
            : 'Não foi possível registrar a decisão.',
        );
        setEnviando(false);
      }
    },
    [draw.id, onDecided],
  );

  const motivoValido = motivo.trim().length >= 3;

  return (
    <li className="card stack stack--sm">
      <div className="row row--between">
        <div>
          <h2 className="card__title">{draw.title}</h2>
          <p className="muted">
            {draw.tenantName} · <code className="slug">{draw.tenantSlug}</code>
          </p>
        </div>
        <span className="badge badge--warning">
          <span className="badge__dot" aria-hidden="true" />
          Em revisão
        </span>
      </div>

      <p>
        <strong>Prêmio:</strong> {draw.prizeName}
      </p>
      <p className="muted">
        Grade de {draw.totalNumbers} números · {formatCents(draw.unitPriceCents)} por número ·
        sorteio em {formatDate(draw.drawDate) ?? 'data não definida'}
      </p>

      {erro && (
        <p className="alert alert--danger" role="alert">
          {erro}
        </p>
      )}

      {podeDecidir && !reprovando && (
        <div className="row">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={enviando}
            onClick={() => void decidir('ATIVA')}
          >
            <CheckCircle2 size={16} aria-hidden="true" />
            Aprovar e ativar
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            disabled={enviando}
            onClick={() => void decidir('AGENDADA')}
          >
            Aprovar e agendar
          </button>
          <button
            type="button"
            className="btn btn--danger-ghost btn--sm"
            disabled={enviando}
            onClick={() => setReprovando(true)}
          >
            <Undo2 size={16} aria-hidden="true" />
            Reprovar
          </button>
        </div>
      )}

      {podeDecidir && reprovando && (
        <form
          className="stack stack--sm"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (motivoValido) void decidir('RASCUNHO', motivo.trim());
          }}
        >
          <label className="field">
            <span className="field__label">Motivo da reprovação (fica registrado na auditoria)</span>
            <textarea
              className="input"
              rows={3}
              maxLength={500}
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              required
            />
          </label>
          <div className="row">
            <button
              type="submit"
              className="btn btn--danger btn--sm"
              disabled={enviando || !motivoValido}
            >
              Devolver ao organizador
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={enviando}
              onClick={() => {
                setReprovando(false);
                setMotivo('');
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
