import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CloudOff, Loader2, Save } from 'lucide-react';
import { type OrganizerDraw } from '@clubedarifa/shared';
import { EntitlementNotice } from '../components/BillingUi.tsx';
import { EntitlementSummary } from '../components/EntitlementSummary.tsx';
import { Loading } from '../components/States.tsx';
import { ErrorPanel, PageHeader } from '../components/Ui.tsx';
import { WizardReview } from '../components/wizard/WizardReview.tsx';
import {
  DuplicatePicker,
  StepAutomations,
  StepBasic,
  StepCustomization,
  StepGrid,
  StepPrice,
  StepPrizes,
  StepRegulation,
  StepSchedule,
} from '../components/wizard/WizardSteps.tsx';
import type { StepProps } from '../components/wizard/fields.tsx';
import { clearLocal, readLocal, useDrawAutosave, type SaveState } from '../hooks/useDrawAutosave.ts';
import { useApiResource } from '../hooks/useApiResource.ts';
import { describeEntitlementError } from '../lib/billingCopy.ts';
import {
  STEP_TITLES,
  emptyForm,
  formFromDraw,
  stepProblems,
  type DrawForm,
  type StepIndex,
} from '../lib/drawForm.ts';
import { useSession } from '../state/SessionProvider.tsx';
import { api } from '../api.ts';

/**
 * Assistente de criacao do sorteio em 9 passos (DOC-01 §4).
 *
 *   /sorteios/novo              comeca do zero (ou de `?duplicar=<id>`)
 *   /sorteios/:id/editar        continua um RASCUNHO
 *
 * O rascunho e salvo sozinho (ver `useDrawAutosave`); sair e voltar nao perde nada. Nada vai
 * para a vitrine antes do passo 9 e da aprovacao da plataforma.
 */

const ULTIMO: StepIndex = 8;

// ---------------------------------------------------------------------------
// Indicador de salvamento
// ---------------------------------------------------------------------------

function SaveIndicator({ state, pending }: { state: SaveState; pending: boolean }) {
  let icone = <Save size={14} aria-hidden="true" />;
  let texto = 'As alterações são salvas automaticamente.';
  let classe = '';
  if (state.kind === 'saving') {
    icone = <Loader2 size={14} className="spin" aria-hidden="true" />;
    texto = 'Salvando…';
  } else if (pending) {
    texto = 'Alterações pendentes…';
  } else if (state.kind === 'error') {
    icone = <AlertTriangle size={14} aria-hidden="true" />;
    texto = state.message;
    classe = 'save-state--erro';
  } else if (state.kind === 'local') {
    icone = <CloudOff size={14} aria-hidden="true" />;
    texto = 'Guardado neste aparelho. Informe título, um prêmio e o preço para salvar no servidor.';
  } else if (state.kind === 'saved') {
    icone = <Check size={14} aria-hidden="true" />;
    texto = `Salvo às ${state.at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    classe = 'save-state--ok';
  }
  return (
    <p className={`save-state ${classe}`} role="status" aria-live="polite">
      {icone}
      <span>{texto}</span>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Estrutura do assistente
// ---------------------------------------------------------------------------

function Wizard({
  initialForm,
  initialDraftId,
  notice,
}: {
  initialForm: DrawForm;
  initialDraftId: string | null;
  notice: string | null;
}) {
  const navigate = useNavigate();
  const { tenant, can } = useSession();
  const scope = tenant?.tenantId ?? 'sem-comunidade';

  const [form, setForm] = useState<DrawForm>(initialForm);
  const [step, setStep] = useState<StepIndex>(0);
  const [visited, setVisited] = useState<ReadonlySet<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [offerSubscription, setOfferSubscription] = useState(false);
  const [hasPaymentAccount, setHasPaymentAccount] = useState<boolean | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  const autosave = useDrawAutosave({
    form,
    initialDraftId,
    scope,
    enabled: !submitting,
    // A URL passa a apontar para o rascunho, sem remontar a tela (nao perde passo nem foco).
    onCreated: (id) => window.history.replaceState(window.history.state, '', `/sorteios/${id}/editar${window.location.search.replace(/[?&]duplicar=[^&]*/, '')}`),
  });

  const set = useCallback(<K extends keyof DrawForm>(chave: K, valor: DrawForm[K]) => {
    setForm((f) => ({ ...f, [chave]: valor }));
  }, []);

  const problemasPorPasso = useMemo(
    () => Object.fromEntries(([0, 1, 3, 4, 6, 7] as const).map((s) => [s, stepProblems(s, form)])),
    [form],
  );

  const irPara = useCallback(
    (destino: StepIndex) => {
      setVisited((v) => new Set(v).add(step));
      setStep(destino);
      void autosave.flush();
    },
    [autosave, step],
  );

  // Ao trocar de passo, o foco vai para o titulo do passo (leitor de tela anuncia onde esta).
  useEffect(() => {
    titulo.current?.focus();
    window.scrollTo({ top: 0 });
  }, [step]);

  // So o passo de revisao precisa saber se ha conta de recebimento.
  useEffect(() => {
    if (step !== ULTIMO || !can('payment_account:read')) return;
    let ativo = true;
    api
      .call('tenantPaymentAccounts')
      .then((r) => ativo && setHasPaymentAccount(r.checkoutAvailable))
      .catch(() => ativo && setHasPaymentAccount(null));
    return () => {
      ativo = false;
    };
  }, [step, can]);

  const enviar = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    setOfferSubscription(false);
    try {
      const id = await autosave.flush();
      if (!id) {
        setSubmitError('Complete título, prêmio e preço para salvar o rascunho antes de enviar.');
        return;
      }
      await api.call('updateDrawStatus', { status: 'REVISÃO COMPLIANCE' }, { params: { id } });
      clearLocal(scope, id);
      clearLocal(scope, null);
      navigate(`/sorteios/${id}`, { replace: true });
    } catch (falha) {
      const d = describeEntitlementError(falha, 'Não foi possível enviar o sorteio para revisão.');
      setSubmitError(d.message);
      setOfferSubscription(d.offerSubscription);
    } finally {
      setSubmitting(false);
    }
  }, [autosave, navigate, scope]);

  const props: StepProps = {
    form,
    set,
    problems: problemasPorPasso[step] ?? [],
    // Os erros de um passo aparecem depois que a pessoa sai dele uma vez (nao no meio da digitacao).
    showErrors: visited.has(step),
  };

  const corpo = (() => {
    switch (step) {
      case 0:
        return <StepBasic {...props} />;
      case 1:
        return <StepPrizes {...props} />;
      case 2:
        return <StepGrid {...props} />;
      case 3:
        return <StepPrice {...props} />;
      case 4:
        return <StepSchedule {...props} />;
      case 5:
        return <StepCustomization {...props} />;
      case 6:
        return <StepRegulation {...props} />;
      case 7:
        return <StepAutomations {...props} />;
      default:
        return (
          <WizardReview
            form={form}
            hasPaymentAccount={hasPaymentAccount}
            submitting={submitting}
            submitError={submitError}
            canSubmit={can('draw:lifecycle:write')}
            onSubmit={() => void enviar()}
          />
        );
    }
  })();

  return (
    <div className="dash__content--narrow wizard">
      <Link className="back-link" to="/sorteios">
        <ArrowLeft size={16} aria-hidden="true" />
        Sorteios
      </Link>

      <PageHeader
        title={initialDraftId || autosave.draftId ? 'Editar rascunho' : 'Novo sorteio'}
        description="Preencha em qualquer ordem. O rascunho é salvo sozinho: você pode sair e voltar. Para vender, envie-o para revisão no último passo."
      />

      <EntitlementSummary kind="draws" />

      {notice && (
        <div className="alert alert--info" role="status">
          <div className="alert__body">{notice}</div>
        </div>
      )}

      <nav aria-label="Passos do assistente" className="stepper">
        <ol className="stepper__list">
          {STEP_TITLES.map((nome, i) => {
            const atual = i === step;
            const comProblema = visited.has(i) && (problemasPorPasso[i]?.length ?? 0) > 0;
            const feito = visited.has(i) && !comProblema;
            return (
              <li key={nome} className="stepper__item">
                <button
                  type="button"
                  className={`stepper__btn${atual ? ' is-current' : ''}${comProblema ? ' has-problem' : ''}${feito ? ' is-done' : ''}`}
                  aria-current={atual ? 'step' : undefined}
                  onClick={() => irPara(i as StepIndex)}
                >
                  <span className="stepper__num" aria-hidden="true">
                    {feito ? <Check size={12} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="stepper__label">{nome}</span>
                  {comProblema && <span className="sr-only"> (há pendências)</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <SaveIndicator state={autosave.state} pending={autosave.pending} />
      {autosave.state.kind === 'saved' && autosave.state.skipped.length > 0 && !autosave.pending && (
        <p className="field__hint">
          Alguns campos ainda estão incompletos e não foram enviados ao servidor; o restante está salvo.
        </p>
      )}

      <section className="card" aria-labelledby="passo-titulo">
        <div className="card__body stack stack--lg">
          <h2 id="passo-titulo" className="fieldset__legend" ref={titulo} tabIndex={-1}>
            Passo {step + 1} de {STEP_TITLES.length} · {STEP_TITLES[step]}
          </h2>
          {step === 0 && !autosave.draftId && (
            <DuplicateSource
              onPick={(d) => {
                setForm(formFromDraw(d, { duplicate: true }));
              }}
            />
          )}
          {corpo}
        </div>
      </section>

      {submitError && offerSubscription && (
        <EntitlementNotice message={submitError} offerSubscription canOpenSubscription={can('billing:read')} />
      )}

      <div className="form-actions wizard__nav">
        <button
          type="button"
          className="btn btn--ghost"
          disabled={step === 0}
          onClick={() => irPara((step - 1) as StepIndex)}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Voltar
        </button>
        {step < ULTIMO && (
          <button type="button" className="btn btn--primary" onClick={() => irPara((step + 1) as StepIndex)}>
            Próximo
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Carrega os sorteios da comunidade para o "duplicar de um anterior". */
function DuplicateSource({ onPick }: { onPick: (d: OrganizerDraw) => void }) {
  const lista = useApiResource((signal) => api.call('organizerDraws', undefined, { query: { limit: 50 }, signal }), []);
  if (lista.status !== 'ready' || !lista.data) return null;
  return <DuplicatePicker options={lista.data.draws} onPick={onPick} />;
}

// ---------------------------------------------------------------------------
// Rota: decide de onde vem o estado inicial
// ---------------------------------------------------------------------------

function EditDraft({ id }: { id: string }) {
  const { tenant } = useSession();
  const scope = tenant?.tenantId ?? 'sem-comunidade';
  const draw = useApiResource<OrganizerDraw>((signal) => api.call('organizerDraw', undefined, { params: { id }, signal }), [id]);

  if (draw.status === 'loading') return <Loading label="Carregando o rascunho…" />;
  if (draw.status === 'error') return <ErrorPanel error={draw.error} onRetry={draw.reload} />;
  const d = draw.data!;

  if (d.status !== 'RASCUNHO') {
    return (
      <div className="dash__content--narrow stack">
        <PageHeader title={d.title} />
        <div className="alert alert--warning" role="status">
          <div className="alert__body stack stack--sm">
            <p className="alert__title">Este sorteio não está mais em rascunho</p>
            <p>Só o rascunho pode ser editado. Veja o andamento na página do sorteio.</p>
            <Link className="btn btn--secondary btn--sm" to={`/sorteios/${d.id}`}>
              Abrir o sorteio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Se uma edicao ficou sem chegar ao servidor (rede caiu), a copia local prevalece.
  const local = readLocal(scope, id);
  const usarLocal = local?.dirty === true;
  return (
    <Wizard
      initialForm={usarLocal ? local!.form : formFromDraw(d)}
      initialDraftId={id}
      notice={usarLocal ? 'Recuperamos alterações que não tinham chegado ao servidor. Elas serão salvas agora.' : null}
    />
  );
}

function DuplicateDraft({ sourceId }: { sourceId: string }) {
  const draw = useApiResource<OrganizerDraw>((signal) => api.call('organizerDraw', undefined, { params: { id: sourceId }, signal }), [sourceId]);
  if (draw.status === 'loading') return <Loading label="Carregando o sorteio de origem…" />;
  if (draw.status === 'error') return <ErrorPanel error={draw.error} onRetry={draw.reload} />;
  return (
    <Wizard
      initialForm={formFromDraw(draw.data!, { duplicate: true })}
      initialDraftId={null}
      notice="Cópia de um sorteio anterior: números vendidos, datas e resultado não foram copiados. Defina as datas no passo 5."
    />
  );
}

function FreshDraft() {
  const { tenant } = useSession();
  const scope = tenant?.tenantId ?? 'sem-comunidade';
  const local = useMemo(() => readLocal(scope, null), [scope]);
  return (
    <Wizard
      initialForm={local?.form ?? emptyForm()}
      initialDraftId={null}
      notice={local ? 'Recuperamos o que você estava preenchendo neste aparelho.' : null}
    />
  );
}

export function DrawWizardPage() {
  const { id } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const duplicar = search.get('duplicar');
  // `key` troca o estado inteiro quando a origem muda (outro rascunho / outra copia).
  if (id) return <EditDraft key={id} id={id} />;
  if (duplicar) return <DuplicateDraft key={duplicar} sourceId={duplicar} />;
  return <FreshDraft />;
}
