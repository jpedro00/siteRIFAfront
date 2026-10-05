import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { describeUsage, type Tone } from '../lib/billingCopy.ts';

/**
 * Pecas compartilhadas por "Minha assinatura", "Recebimentos" e pelos avisos de limite.
 * O estado NUNCA e so cor: toda etiqueta traz o texto, e o icone e decorativo.
 */

const BADGE_BY_TONE: Record<Tone, string> = {
  success: 'badge--success',
  warning: 'badge--warning',
  danger: 'badge--danger',
  info: 'badge--info',
  neutral: 'badge--neutral',
};

export function ToneBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`badge ${BADGE_BY_TONE[tone]}`}>
      <span className="badge__dot" aria-hidden="true" />
      {children}
    </span>
  );
}

const ALERT_BY_TONE: Record<Tone, string> = {
  success: 'alert--success',
  warning: 'alert--warning',
  danger: 'alert--danger',
  info: 'alert--info',
  neutral: 'alert--info',
};

/** Aviso com titulo e texto. `live` faz o leitor de tela anunciar quando o aviso aparece. */
export function Notice({
  tone,
  title,
  children,
  live = 'polite',
}: {
  tone: Tone;
  title?: string;
  children?: ReactNode;
  live?: 'polite' | 'assertive';
}) {
  return (
    <div className={`alert ${ALERT_BY_TONE[tone]}`} role={live === 'assertive' ? 'alert' : 'status'}>
      <div className="alert__body stack stack--sm">
        {title && <p className="alert__title">{title}</p>}
        {children}
      </div>
    </div>
  );
}

/**
 * Consumo de um limite: "4 de 5" com barra, ou "4 em uso · sem limite" (sem barra) quando
 * nao ha teto. A barra e redundante para quem nao enxerga: o valor esta sempre em texto.
 */
export function UsageMeter({ label, used, max }: { label: string; used: number; max: number | null }) {
  const cheio = max !== null && max > 0 && used >= max;
  const percentual = max === null ? 0 : max === 0 ? 100 : Math.min(100, Math.floor((used / max) * 100));
  return (
    <div className="progress">
      <div className="progress__meta">
        <span>{label}</span>
        <span className="progress__value">
          {describeUsage(used, max)}
          {cheio ? ' · limite atingido' : ''}
        </span>
      </div>
      {max !== null && (
        <div
          className="progress__track"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={Math.min(used, max)}
          aria-valuetext={describeUsage(used, max)}
        >
          <div className={`progress__fill${cheio ? '' : ' progress__fill--success'}`} style={{ width: `${percentual}%` }} />
        </div>
      )}
    </div>
  );
}

/** Erro de limite/assinatura com o atalho para "Minha assinatura". */
export function EntitlementNotice({
  message,
  offerSubscription,
  canOpenSubscription,
}: {
  message: string;
  offerSubscription: boolean;
  /** So oferece o link a quem pode abrir a area (billing:read). */
  canOpenSubscription: boolean;
}) {
  return (
    <div className="alert alert--warning" role="alert">
      <div className="alert__body stack stack--sm">
        <p>{message}</p>
        {offerSubscription && canOpenSubscription && (
          <p>
            <Link className="btn btn--secondary btn--sm" to="/assinatura">
              Ver minha assinatura
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Confirmacao dentro da propria tela (o mesmo padrao do "encerrar vendas": nao usa o dialogo
 * nativo do navegador). Ao abrir, o foco vai para o titulo; Esc cancela; ao fechar, o foco
 * volta para quem abriu (`returnFocusRef`).
 */
export function ConfirmPanel({
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancelar',
  busy,
  danger = true,
  onConfirm,
  onCancel,
  returnFocusRef,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const titleRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    // Le o ref so na SAIDA: o botao que abriu o painel pode ter sido recriado enquanto ele
    // estava aberto, e o foco precisa ir para o elemento que existe agora.
    return () => returnFocusRef?.current?.focus();
  }, [returnFocusRef]);

  return (
    <div
      className={`alert ${danger ? 'alert--warning' : 'alert--info'}`}
      role="alertdialog"
      aria-labelledby="confirm-panel-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <div className="alert__body stack stack--sm">
        <p className="alert__title" id="confirm-panel-title" ref={titleRef} tabIndex={-1}>
          {title}
        </p>
        {children}
        <div className="row">
          <button type="button" className={`btn btn--sm ${danger ? 'btn--danger' : 'btn--primary'}`} disabled={busy} onClick={onConfirm}>
            {busy ? <span className="btn__spinner" aria-hidden="true" /> : null}
            {confirmLabel}
          </button>
          <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
