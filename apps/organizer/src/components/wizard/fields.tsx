import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { isLegibleAccent } from '@clubedarifa/shared';
import type { DrawForm, StepProblem } from '../../lib/drawForm.ts';

/**
 * Pecas de formulario do assistente. Cada campo liga rotulo, dica e erro por `id`
 * (`aria-describedby`), e o erro e anunciado: quem usa leitor de tela precisa ouvir o
 * mesmo que quem ve.
 */

export interface StepProps {
  readonly form: DrawForm;
  readonly set: <K extends keyof DrawForm>(chave: K, valor: DrawForm[K]) => void;
  /** Problemas deste passo (so aparecem quando `showErrors`). */
  readonly problems: readonly StepProblem[];
  readonly showErrors: boolean;
}

export const erroDe = (props: Pick<StepProps, 'problems' | 'showErrors'>, campo: string): string | undefined =>
  props.showErrors ? props.problems.find((p) => p.field === campo)?.message : undefined;

interface BaseProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: ReactNode;
  readonly error?: string | undefined;
  readonly required?: boolean;
  readonly optional?: boolean;
}

function Moldura({ id, label, hint, error, required, optional, children }: BaseProps & { children: ReactNode }) {
  return (
    <div className={`field${error ? ' field--invalid' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required && (
          <>
            {' '}
            <span className="field__required" aria-hidden="true">
              *
            </span>
          </>
        )}
        {optional && <span className="muted"> (opcional)</span>}
      </label>
      {children}
      {error ? (
        <p className="field__error" id={`${id}-erro`} role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      ) : (
        hint && (
          <p className="field__hint" id={`${id}-dica`}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

const descrito = (id: string, error?: string, hint?: ReactNode) =>
  error ? `${id}-erro` : hint ? `${id}-dica` : undefined;

export function TextField(
  props: BaseProps & {
    readonly value: string;
    readonly onChange: (v: string) => void;
    readonly maxLength?: number;
    readonly type?: 'text' | 'url' | 'datetime-local';
    readonly inputMode?: 'decimal' | 'url' | 'numeric';
    readonly placeholder?: string;
    readonly prefix?: string;
    readonly list?: string;
  },
) {
  const { id, value, onChange, maxLength, type = 'text', inputMode, placeholder, prefix, list, error, hint } = props;
  const input = (
    <input
      id={id}
      className="field__input"
      type={type}
      value={value}
      maxLength={maxLength}
      inputMode={inputMode}
      placeholder={placeholder}
      list={list}
      aria-invalid={error ? true : undefined}
      aria-describedby={descrito(id, error, hint)}
      onChange={(e) => onChange(e.target.value)}
    />
  );
  return (
    <Moldura {...props}>
      {prefix ? (
        <div className="field__group">
          <span className="field__prefix" aria-hidden="true">
            {prefix}
          </span>
          {input}
        </div>
      ) : (
        input
      )}
    </Moldura>
  );
}

export function TextAreaField(
  props: BaseProps & {
    readonly value: string;
    readonly onChange: (v: string) => void;
    readonly maxLength?: number;
    readonly rows?: number;
  },
) {
  const { id, value, onChange, maxLength, rows = 5, error, hint } = props;
  return (
    <Moldura {...props}>
      <textarea
        id={id}
        className="field__textarea"
        value={value}
        rows={rows}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={descrito(id, error, hint)}
        onChange={(e) => onChange(e.target.value)}
      />
    </Moldura>
  );
}

export function SelectField<T extends string>(
  props: BaseProps & {
    readonly value: T;
    readonly onChange: (v: T) => void;
    readonly options: readonly { value: T; label: string }[];
  },
) {
  const { id, value, onChange, options, error, hint } = props;
  return (
    <Moldura {...props}>
      <select
        id={id}
        className="field__input"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={descrito(id, error, hint)}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Moldura>
  );
}

/** Funcionalidade do DOC-01 que depende de infraestrutura ainda inexistente: dita, nunca simulada. */
export function ComingSoon({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <aside className="coming-soon" aria-label={title}>
      <p className="coming-soon__title">{title}</p>
      <ul className="plain-list">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </aside>
  );
}

export function CheckField({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  checked: boolean;
  onChange: (valor: boolean) => void;
}) {
  return (
    <div className="field">
      <label className="check" htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-describedby={hint ? `${id}-dica` : undefined} />
        <span>{label}</span>
      </label>
      {hint && (
        <p className="field__hint" id={`${id}-dica`}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function ColorField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  value: string;
  onChange: (valor: string) => void;
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label} <span className="muted">(opcional)</span>
      </label>
      <div className="row">
        <input id={id} type="color" className="color-input" value={value || '#1d4ed8'} onChange={(e) => onChange(e.target.value)} />
        <span className="muted">{value || 'Cor padrão da comunidade'}</span>
        {value && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange('')}>
            Usar a cor padrão
          </button>
        )}
      </div>
      {value && !isLegibleAccent(value) ? (
        <p className="field__error" role="alert">
          Esta cor é clara demais: o botão com texto branco ficaria difícil de ler. A vitrine vai usar a cor padrão.
        </p>
      ) : (
        hint && <p className="field__hint">{hint}</p>
      )}
    </div>
  );
}
