import { useState } from 'react';
import { AlertCircle, CheckCircle2, Monitor, Send, Smartphone } from 'lucide-react';
import {
  RESERVATION_TTL_MINUTES,
  formatCents,
  formatNumberLabel,
  labelDigitsForGridSize,
} from '@clubedarifa/shared';
import {
  filledPrizes,
  localInputToIso,
  parseMoneyToCents,
  submissionProblems,
  type DrawForm,
} from '../../lib/drawForm.ts';

/**
 * Passo 9 · revisao. Checklist (os mesmos criterios da API, via `@clubedarifa/shared`) e
 * pre-visualizacao do que o participante vai ver, no celular e no desktop.
 */

export function DrawPreview({ form, mode }: { form: DrawForm; mode: 'mobile' | 'desktop' }) {
  const premios = filledPrizes(form);
  const principal = premios[0];
  const preco = parseMoneyToCents(form.price);
  const promo = parseMoneyToCents(form.promoPrice);
  const promoAte = localInputToIso(form.promoUntil);
  const promoVale = promo !== null && promoAte !== undefined && preco !== null && promo < preco;
  const digitos = labelDigitsForGridSize(form.totalNumbers);
  const amostra = Array.from({ length: 20 }, (_, n) => formatNumberLabel(n, digitos));
  const imagem = principal && /^https:\/\//i.test(principal.imageUrl.trim()) ? principal.imageUrl.trim() : null;

  const progresso =
    form.progressMode === 'OCULTAR'
      ? null
      : form.progressMode === 'PERCENTUAL'
        ? '0% vendido'
        : `Faltam ${form.totalNumbers} números`;

  return (
    <div className={`preview preview--${mode}`} aria-label={`Pré-visualização no ${mode === 'mobile' ? 'celular' : 'desktop'}`}>
      <div className="preview__page">
        <div className="preview__cover">
          {imagem ? (
            <img src={imagem} alt={`Foto de ${principal?.name ?? 'prêmio'}`} referrerPolicy="no-referrer" loading="lazy" />
          ) : (
            <span className="preview__placeholder">Sem foto do prêmio</span>
          )}
        </div>
        <div className="preview__body">
          {form.category.trim() && <p className="preview__kicker">{form.category.trim()}</p>}
          <h3 className="preview__title">{form.title.trim() || 'Título do sorteio'}</h3>
          {form.subtitle.trim() && <p className="preview__subtitle">{form.subtitle.trim()}</p>}
          {form.headline.trim() && <p className="preview__headline">{form.headline.trim()}</p>}

          <ul className="preview__prizes">
            {premios.length === 0 && <li className="muted">Nenhum prêmio ainda</li>}
            {premios.map((p, i) => {
              const valor = parseMoneyToCents(p.value);
              return (
                <li key={p.key}>
                  <strong>{i + 1}º</strong> {p.name.trim() || '—'}
                  {valor !== null && <span className="muted"> · valor estimado {formatCents(valor)}</span>}
                </li>
              );
            })}
          </ul>

          <p className="preview__price">
            {promoVale && preco !== null ? (
              <>
                <s>{formatCents(preco)}</s> <strong>{formatCents(promo!)}</strong> por número
              </>
            ) : (
              <strong>{preco === null ? 'Defina o preço' : `${formatCents(preco)} por número`}</strong>
            )}
          </p>
          {progresso && <p className="preview__progress">{progresso}</p>}

          <ul className="preview__grid" aria-hidden="true">
            {amostra.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="preview__note">
            Sua reserva vale por {RESERVATION_TTL_MINUTES} minutos. O regulamento está disponível nesta página.
          </p>
          <button type="button" className="btn btn--primary" tabIndex={-1} aria-hidden="true">
            {form.ctaLabel.trim() || 'Reservar números'}
          </button>

          <details className="preview__regulation">
            <summary>Regulamento</summary>
            <p>{form.regulation.trim() ? form.regulation.trim().slice(0, 600) : 'O regulamento ainda não foi preenchido.'}</p>
          </details>
        </div>
      </div>
    </div>
  );
}

export function WizardReview({
  form,
  hasPaymentAccount,
  submitting,
  submitError,
  canSubmit,
  onSubmit,
}: {
  form: DrawForm;
  /** `null` = nao foi possivel saber (sem permissao ou API fora). */
  hasPaymentAccount: boolean | null;
  submitting: boolean;
  submitError: string | null;
  canSubmit: boolean;
  onSubmit: () => void;
}) {
  const [modo, setModo] = useState<'mobile' | 'desktop'>('mobile');
  const problemas = submissionProblems(form);

  return (
    <div className="stack stack--lg">
      <section aria-labelledby="checklist-titulo" className="card">
        <div className="card__body stack">
          <h3 id="checklist-titulo" className="fieldset__legend">
            Checklist para enviar à revisão
          </h3>
          {problemas.length === 0 ? (
            <p className="check-ok">
              <CheckCircle2 size={16} aria-hidden="true" /> Tudo certo: o sorteio pode ser enviado.
            </p>
          ) : (
            <ul className="plain-list check-list">
              {problemas.map((p) => (
                <li key={p}>
                  <AlertCircle size={14} aria-hidden="true" /> {p}
                </li>
              ))}
            </ul>
          )}
          {hasPaymentAccount === false && (
            <p className="alert alert--warning check-warning" role="status">
              A comunidade ainda não tem uma conta de recebimento conectada. Você pode enviar o sorteio, mas os
              participantes só conseguem pagar depois que a conta for conectada em “Recebimentos”.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="previa-titulo" className="stack">
        <div className="preview__bar">
          <h3 id="previa-titulo" className="fieldset__legend">
            Pré-visualização
          </h3>
          <div className="row" role="group" aria-label="Tamanho da pré-visualização">
            <button
              type="button"
              className={`btn btn--sm ${modo === 'mobile' ? 'btn--secondary' : 'btn--ghost'}`}
              aria-pressed={modo === 'mobile'}
              onClick={() => setModo('mobile')}
            >
              <Smartphone size={15} aria-hidden="true" /> Celular
            </button>
            <button
              type="button"
              className={`btn btn--sm ${modo === 'desktop' ? 'btn--secondary' : 'btn--ghost'}`}
              aria-pressed={modo === 'desktop'}
              onClick={() => setModo('desktop')}
            >
              <Monitor size={15} aria-hidden="true" /> Desktop
            </button>
          </div>
        </div>
        <DrawPreview form={form} mode={modo} />
      </section>

      {submitError && (
        <div className="alert alert--danger" role="alert">
          <div className="alert__body">{submitError}</div>
        </div>
      )}

      <div className="form-actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={!canSubmit || problemas.length > 0 || submitting}
          onClick={onSubmit}
        >
          {submitting ? <span className="btn__spinner" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
          {submitting ? 'Enviando…' : 'Enviar para revisão'}
        </button>
      </div>
      {!canSubmit && (
        <p className="field__hint">Seu perfil não pode enviar sorteios para revisão. Peça a quem administra a comunidade.</p>
      )}
    </div>
  );
}
