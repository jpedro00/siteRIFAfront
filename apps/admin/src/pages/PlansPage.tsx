import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Plus, RefreshCw, X } from 'lucide-react';
import {
  ApiClientError,
  formatDate,
  type CreatePlanRequest,
  type PlanInterval,
  type PlanStatus,
  type PlatformPlan,
} from '@clubedarifa/shared';
import { api } from '../api.ts';
import { ConfirmPanel, ToneBadge } from '../components/BillingUi.tsx';
import { ErrorState, Loading } from '../components/States.tsx';
import { useApiResource } from '../hooks/useApiResource.ts';
import {
  PLAN_STATUS_VIEW,
  formatPlanPrice,
  isPendingSync,
  limitLabel,
  parsePriceToCents,
  statusActions,
} from '../lib/billingAdmin.ts';
import { useSession } from '../state/SessionProvider.tsx';

/**
 * Catalogo de planos (Fase 7 · PLATFORM_FINANCE).
 *
 * O Super Admin informa codigo, nome, preco, periodicidade e limites; o SERVIDOR cria o
 * Product e o Price na Stripe e grava os IDs. Nenhum ID da Stripe e digitado aqui.
 *
 * O preco de um plano sincronizado nao se edita (o Price da Stripe e imutavel): preco novo =
 * plano novo. Arquivar tira o plano da vitrine, mas ele continua visivel para quem ja o
 * contratou.
 */

type Pendente = { plan: PlatformPlan; to: PlanStatus } | null;

export function PlansPage() {
  const { can } = useSession();
  const podeGerir = can('platform:billing:manage');
  const planos = useApiResource((signal) => api.call('platformPlans', undefined, { signal }), []);
  const [criando, setCriando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<Pendente>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const mudarStatus = async (plano: PlatformPlan, para: PlanStatus) => {
    setOcupado(plano.id);
    setErro(null);
    setAviso(null);
    try {
      await api.call('platformUpdatePlan', { status: para }, { params: { id: plano.id } });
      setAviso(`Plano ${plano.code}: ${PLAN_STATUS_VIEW[para].label.toLowerCase()}.`);
      setConfirmando(null);
      planos.reload();
    } catch (falha) {
      setErro(falha instanceof ApiClientError ? falha.message : 'Não foi possível alterar o plano.');
      setConfirmando(null);
    } finally {
      setOcupado(null);
    }
  };

  /** Plano gravado sem Price: repetir o pedido com os mesmos dados RETOMA a sincronizacao. */
  const concluirSincronizacao = async (plano: PlatformPlan) => {
    setOcupado(plano.id);
    setErro(null);
    setAviso(null);
    try {
      await api.call('platformCreatePlan', {
        code: plano.code,
        name: plano.name,
        ...(plano.description ? { description: plano.description } : {}),
        interval: plano.interval,
        priceCents: plano.priceCents,
        currency: plano.currency,
        maxActiveDraws: plano.maxActiveDraws,
        maxTeamMembers: plano.maxTeamMembers,
        features: plano.features,
      });
      setAviso(`Plano ${plano.code} sincronizado com a Stripe.`);
      planos.reload();
    } catch (falha) {
      setErro(falha instanceof ApiClientError ? falha.message : 'Não foi possível concluir a sincronização.');
    } finally {
      setOcupado(null);
    }
  };

  return (
    <>
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Planos</h1>
          <p className="page-header__description">Catálogo de assinaturas vendidas às comunidades.</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn--secondary" onClick={planos.reload} disabled={planos.status === 'loading'}>
            <RefreshCw size={16} aria-hidden="true" />
            Atualizar
          </button>
          {podeGerir && (
            <button type="button" className="btn btn--primary" aria-expanded={criando} onClick={() => setCriando((v) => !v)}>
              {criando ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
              {criando ? 'Fechar' : 'Novo plano'}
            </button>
          )}
        </div>
      </header>

      <div aria-live="polite" className="stack stack--sm">
        {aviso && (
          <div className="alert alert--success" role="status">
            <div className="alert__body">{aviso}</div>
          </div>
        )}
        {erro && (
          <div className="alert alert--danger" role="alert">
            <div className="alert__body">{erro}</div>
          </div>
        )}
      </div>

      {criando && podeGerir && (
        <CreatePlanForm
          onDone={(mensagem) => {
            setCriando(false);
            setAviso(mensagem);
            setErro(null);
            planos.reload();
          }}
          onPartial={(mensagem) => {
            // O rascunho ficou gravado: a lista mostra "sincronizacao pendente".
            setErro(mensagem);
            planos.reload();
          }}
        />
      )}

      {confirmando && (
        <ConfirmPanel
          title={`${confirmando.to === 'ARCHIVED' ? 'Arquivar' : confirmando.to === 'AVAILABLE' ? 'Publicar' : 'Alterar'} o plano ${confirmando.plan.code}?`}
          confirmLabel={confirmando.to === 'ARCHIVED' ? 'Arquivar' : 'Publicar'}
          busy={ocupado === confirmando.plan.id}
          onConfirm={() => void mudarStatus(confirmando.plan, confirmando.to)}
          onCancel={() => setConfirmando(null)}
          returnFocusRef={confirmRef}
        >
          {confirmando.to === 'ARCHIVED' ? (
            <p>
              O plano sai da lista de contratação. Quem já o contratou continua com ele, e ele segue visível para essas
              comunidades e neste catálogo.
            </p>
          ) : (
            <p>O plano passa a aparecer para as comunidades contratarem.</p>
          )}
        </ConfirmPanel>
      )}

      {planos.status === 'loading' && <Loading label="Carregando os planos…" />}
      {planos.status === 'error' && <ErrorState error={planos.error} onRetry={planos.reload} />}

      {planos.status === 'ready' && planos.data && (
        planos.data.plans.length === 0 ? (
          <div className="empty-state">
            <h2 className="empty-state__title">Nenhum plano cadastrado</h2>
            <p className="empty-state__text">Crie o primeiro plano para que as comunidades possam contratar.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Planos do catálogo</caption>
              <thead>
                <tr>
                  <th scope="col">Plano</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Preço</th>
                  <th scope="col">Limites</th>
                  <th scope="col">Stripe</th>
                  <th scope="col">Criado em</th>
                  <th scope="col">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {planos.data.plans.map((p) => {
                  const visao = PLAN_STATUS_VIEW[p.status];
                  const acoes = podeGerir ? statusActions(p) : [];
                  return (
                    <tr key={p.id}>
                      <td>
                        <span className="table__primary">{p.name}</span>
                        <p className="table__secondary">
                          <code className="slug">{p.code}</code>
                        </p>
                        {p.description && <p className="table__secondary">{p.description}</p>}
                      </td>
                      <td>
                        <ToneBadge tone={visao.tone}>{visao.label}</ToneBadge>
                        {isPendingSync(p) && <p className="table__secondary">Sincronização pendente</p>}
                      </td>
                      <td>{formatPlanPrice(p)}</td>
                      <td>
                        <p>Sorteios: {limitLabel(p.maxActiveDraws)}</p>
                        <p>Equipe: {limitLabel(p.maxTeamMembers)}</p>
                        {p.features.length > 0 && <p className="table__secondary">Recursos: {p.features.join(', ')}</p>}
                      </td>
                      <td>
                        <p className="table__secondary">Product: {p.stripeProductId ? <code className="slug">{p.stripeProductId}</code> : '—'}</p>
                        <p className="table__secondary">Price: {p.stripePriceId ? <code className="slug">{p.stripePriceId}</code> : '—'}</p>
                      </td>
                      <td>{formatDate(p.createdAt) ?? '—'}</td>
                      <td>
                        {podeGerir && isPendingSync(p) && (
                          <button type="button" className="btn btn--secondary btn--sm" disabled={ocupado !== null} onClick={() => void concluirSincronizacao(p)}>
                            {ocupado === p.id ? <span className="btn__spinner" aria-hidden="true" /> : null}
                            Concluir sincronização
                          </button>
                        )}
                        {acoes.map((a) => (
                          <button
                            key={a.to}
                            ref={confirmando?.plan.id === p.id ? confirmRef : undefined}
                            type="button"
                            className="btn btn--ghost btn--sm"
                            disabled={ocupado !== null}
                            aria-label={`${a.label} o plano ${p.code}`}
                            onClick={() => {
                              setErro(null);
                              setAviso(null);
                              // Arquivar e publicar mudam o que as comunidades veem: pedem confirmacao.
                              setConfirmando({ plan: p, to: a.to });
                            }}
                          >
                            {a.label}
                          </button>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </>
  );
}

function CreatePlanForm({ onDone, onPartial }: { onDone: (mensagem: string) => void; onPartial: (mensagem: string) => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [interval, setIntervalo] = useState<PlanInterval>('month');
  const [maxDraws, setMaxDraws] = useState('');
  const [maxTeam, setMaxTeam] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroApi, setErroApi] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(event: FormEvent) {
    event.preventDefault();
    const e: Record<string, string> = {};
    const cents = parsePriceToCents(price);
    if (!/^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/.test(code) || code.length < 3 || code.length > 40) {
      e['code'] = 'Use 3 a 40 letras minúsculas, números, hífen ou sublinhado.';
    }
    if (name.trim() === '') e['name'] = 'Informe o nome do plano.';
    if (cents === null) e['price'] = 'Informe um valor válido, como 49,90.';
    // Vazio = ilimitado. Preenchido precisa ser um inteiro valido.
    const draws = maxDraws.trim() === '' ? null : Number(maxDraws);
    const team = maxTeam.trim() === '' ? null : Number(maxTeam);
    if (draws !== null && (!Number.isInteger(draws) || draws < 0)) e['maxDraws'] = 'Use um número inteiro (0 ou mais) ou deixe vazio para ilimitado.';
    if (team !== null && (!Number.isInteger(team) || team < 1)) e['maxTeam'] = 'Use um número inteiro (1 ou mais) ou deixe vazio para ilimitado.';
    setErros(e);
    setErroApi(null);
    if (Object.keys(e).length > 0 || cents === null) return;

    const body: CreatePlanRequest = {
      code,
      name: name.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      interval,
      priceCents: cents,
      currency: 'brl',
      maxActiveDraws: draws,
      maxTeamMembers: team,
      features: [],
    };

    setEnviando(true);
    try {
      const plano = await api.call('platformCreatePlan', body);
      onDone(`Plano ${plano.code} criado como rascunho e sincronizado com a Stripe. Publique-o quando quiser vendê-lo.`);
    } catch (falha) {
      if (falha instanceof ApiClientError && falha.code === 'BILLING_UNAVAILABLE') {
        onPartial(
          'A Stripe não respondeu ao criar o plano. O rascunho foi salvo: use "Concluir sincronização" na lista para tentar de novo, sem duplicar nada.',
        );
      } else if (falha instanceof ApiClientError && falha.code === 'CONFLICT') {
        setErroApi(falha.message);
      } else {
        setErroApi(falha instanceof ApiClientError ? falha.message : 'Não foi possível criar o plano.');
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="card" style={{ marginBottom: 24 }} aria-labelledby="novo-plano">
      <div className="card__header">
        <div>
          <h2 className="card__title" id="novo-plano">
            Novo plano
          </h2>
          <p className="card__subtitle">
            O preço não pode ser alterado depois de criado. Para mudar o valor, crie um plano novo.
          </p>
        </div>
      </div>
      <form className="card__body stack" noValidate onSubmit={(e) => void enviar(e)}>
        {erroApi && (
          <div className="alert alert--danger" role="alert">
            <div className="alert__body">{erroApi}</div>
          </div>
        )}
        <div className="field-grid">
          <Field id="plano-codigo" label="Código" error={erros['code']} hint="Identificador curto e único, como basico-mensal.">
            <input id="plano-codigo" className="field__input" value={code} onChange={(e) => setCode(e.target.value.trim().toLowerCase())} aria-invalid={erros['code'] ? true : undefined} />
          </Field>
          <Field id="plano-nome" label="Nome" error={erros['name']}>
            <input id="plano-nome" className="field__input" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={erros['name'] ? true : undefined} />
          </Field>
        </div>
        <Field id="plano-descricao" label="Descrição (opcional)">
          <textarea id="plano-descricao" className="field__textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="field-grid">
          <Field id="plano-preco" label="Preço (R$)" error={erros['price']}>
            <input id="plano-preco" className="field__input" inputMode="decimal" placeholder="49,90" value={price} onChange={(e) => setPrice(e.target.value)} aria-invalid={erros['price'] ? true : undefined} />
          </Field>
          <Field id="plano-periodicidade" label="Periodicidade">
            <select id="plano-periodicidade" className="field__input" value={interval} onChange={(e) => setIntervalo(e.target.value as PlanInterval)}>
              <option value="month">Mensal</option>
              <option value="year">Anual</option>
            </select>
          </Field>
        </div>
        <div className="field-grid">
          <Field id="plano-sorteios" label="Limite de sorteios ativos" error={erros['maxDraws']} hint="Vazio = ilimitado.">
            <input id="plano-sorteios" className="field__input" inputMode="numeric" value={maxDraws} onChange={(e) => setMaxDraws(e.target.value)} aria-invalid={erros['maxDraws'] ? true : undefined} />
          </Field>
          <Field id="plano-equipe" label="Limite de equipe (além do proprietário)" error={erros['maxTeam']} hint="Vazio = ilimitado.">
            <input id="plano-equipe" className="field__input" inputMode="numeric" value={maxTeam} onChange={(e) => setMaxTeam(e.target.value)} aria-invalid={erros['maxTeam'] ? true : undefined} />
          </Field>
        </div>
        <p className="muted">Nenhuma funcionalidade comercial está definida ainda; por isso o plano nasce sem recursos extras.</p>
        <div className="row">
          <button type="submit" className="btn btn--primary" disabled={enviando}>
            {enviando ? <span className="btn__spinner" aria-hidden="true" /> : null}
            Criar plano
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={`field${error ? ' field--invalid' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && !error && <p className="field__hint">{hint}</p>}
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
