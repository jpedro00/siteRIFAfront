import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { ApiClientError, type DrawStatusPhase2 } from '@campaigns/shared';

/**
 * Pecas de interface do painel.
 *
 * Diferenca de tom em relacao a vitrine: aqui quem le OPERA o sistema e tem o
 * que fazer com a informacao. O codigo do erro aparece — ele ajuda a abrir um
 * chamado — mas a frase continua sendo em portugues, e nao um despejo de
 * excecao.
 */

export function PageHeader({
  title,
  description,
  badge,
  actions,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        <h1 className="page-header__title">
          {title}
          {badge}
        </h1>
        {description && <p className="page-header__description">{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

/**
 * Cartao de metrica.
 *
 * `value` e sempre um dado REAL vindo da API. Quando uma metrica nao pode ser
 * calculada com o que o backend oferece, o cartao nao entra na tela — um
 * numero de exemplo num painel de gestao e pior que um espaco vazio, porque
 * alguem vai tomar decisao com ele.
 */
export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  tone?: 'brand' | 'success' | 'warning' | 'neutral';
}) {
  return (
    <article className="metric">
      <div className="metric__head">
        <p className="metric__label">{label}</p>
        <span className={`metric__icon${tone === 'brand' ? '' : ` metric__icon--${tone}`}`}>
          {icon}
        </span>
      </div>
      <p className="metric__value">{value}</p>
      {hint && <p className="metric__hint">{hint}</p>}
    </article>
  );
}

const ESTADO_SORTEIO: Record<DrawStatusPhase2, { texto: string; variante: string }> = {
  RASCUNHO: { texto: 'Rascunho', variante: 'badge--neutral' },
  ATIVA: { texto: 'Ativa', variante: 'badge--success badge--live' },
  PAUSADA: { texto: 'Pausada', variante: 'badge--warning' },
  'VENDAS ENCERRADAS': { texto: 'Encerrada', variante: 'badge--neutral' },
};

export function StatusBadge({ status }: { status: DrawStatusPhase2 }) {
  const info = ESTADO_SORTEIO[status];
  return (
    <span className={`badge ${info.variante}`}>
      <span className="badge__dot" aria-hidden="true" />
      {info.texto}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">{icon}</span>
      <h2 className="empty-state__title">{title}</h2>
      <p className="empty-state__text">{text}</p>
      {action && <div className="empty-state__actions">{action}</div>}
    </div>
  );
}

export function ErrorPanel({
  error,
  onRetry,
  title = 'Não foi possível carregar',
}: {
  error?: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const apiError = error instanceof ApiClientError ? error : null;

  return (
    <div className="empty-state empty-state--danger" role="alert">
      <span className="empty-state__icon">
        <AlertTriangle size={26} aria-hidden="true" />
      </span>
      <h2 className="empty-state__title">{title}</h2>
      <p className="empty-state__text">
        {apiError?.message ?? 'Ocorreu um erro inesperado. Tente novamente em instantes.'}
      </p>
      {apiError && <p className="empty-state__text subtle">Código: {apiError.code}</p>}
      {onRetry && (
        <div className="empty-state__actions">
          <button type="button" className="btn btn--secondary" onClick={onRetry}>
            <RefreshCw size={16} aria-hidden="true" />
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        Carregando os dados.
      </p>
      <div className="table-wrap" aria-hidden="true">
        <table className="table">
          <tbody>
            {Array.from({ length: rows }, (_, linha) => (
              <tr key={linha}>
                {Array.from({ length: cols }, (_, coluna) => (
                  <td key={coluna}>
                    <span
                      className="skeleton skeleton--text"
                      style={{ display: 'block', width: coluna === 0 ? '70%' : '45%' }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function MetricsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        Carregando os indicadores.
      </p>
      <div className="metrics" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <article key={i} className="metric">
            <div className="metric__head">
              <span className="skeleton skeleton--text" style={{ width: 90 }} />
              <span className="skeleton skeleton--circle" style={{ width: 32, height: 32 }} />
            </div>
            <span className="skeleton skeleton--title" style={{ width: 70 }} />
          </article>
        ))}
      </div>
    </>
  );
}
