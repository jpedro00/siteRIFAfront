import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import type { Tone } from '../lib/billingAdmin.ts';

/** Etiquetas e confirmacao do console. O estado nunca e so cor: o texto esta sempre no selo. */

const BADGE: Record<Tone, string> = {
  success: 'badge--success',
  warning: 'badge--warning',
  danger: 'badge--danger',
  info: 'badge--info',
  neutral: 'badge--neutral',
};

export function ToneBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`badge ${BADGE[tone]}`}>
      <span className="badge__dot" aria-hidden="true" />
      {children}
    </span>
  );
}

/**
 * Confirmacao dentro da propria tela (nao usa o dialogo nativo). O foco vai para o titulo ao
 * abrir, Esc cancela e o foco volta a quem abriu.
 */
export function ConfirmPanel({
  title,
  children,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
  returnFocusRef,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy: boolean;
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
      className="alert alert--warning"
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
          <button type="button" className="btn btn--primary btn--sm" disabled={busy} onClick={onConfirm}>
            {busy ? <span className="btn__spinner" aria-hidden="true" /> : null}
            {confirmLabel}
          </button>
          <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
