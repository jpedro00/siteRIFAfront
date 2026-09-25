import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Building2, CheckCircle2, Plus, RefreshCw, X } from 'lucide-react';
import { ApiClientError, formatDate, type TenantListResponse } from '@campaigns/shared';
import { api } from '../api.ts';
import { useSession } from '../state/SessionProvider.tsx';
import { ErrorState } from '../components/States.tsx';

/**
 * Comunidades da plataforma. DOC-01 secao 2, passo 1 (M01 · M11 · RN01).
 *
 * Criar comunidade grava, na MESMA transacao: a comunidade, a trilha de
 * auditoria e o evento `tenant.created` na outbox. O worker consome o evento e
 * provisiona a marca padrao.
 *
 * O formulario so aparece para quem tem `platform:tenant:create`, e fica
 * recolhido ate ser pedido: a tarefa frequente aqui e CONSULTAR comunidades,
 * nao criar uma. Um formulario permanentemente aberto empurraria a tabela —
 * o conteudo principal — para baixo da dobra.
 *
 * O backend recusa a rota de qualquer forma; esconder o formulario e
 * conveniencia, nao controle de acesso.
 */

/*
 * As chaves sao os valores do enum `tenant_status` (migration 0002), em
 * ingles: ACTIVE, SUSPENDED, ARCHIVED. O rotulo em portugues e so
 * apresentacao — traduzir a CHAVE criaria um segundo vocabulario para o
 * mesmo estado, que e exatamente o erro que as constantes protegidas do
 * pacote compartilhado existem para impedir.
 */
const SITUACAO: Record<string, { texto: string; variante: string }> = {
  ACTIVE: { texto: 'Ativa', variante: 'badge--success' },
  SUSPENDED: { texto: 'Suspensa', variante: 'badge--warning' },
  ARCHIVED: { texto: 'Arquivada', variante: 'badge--neutral' },
};

function SituacaoBadge({ status }: { status: string }) {
  // Situacao desconhecida nao pode sumir da tela: mostra o valor cru, que e
  // mais util para quem opera do que um espaco em branco.
  const info = SITUACAO[status] ?? { texto: status, variante: 'badge--neutral' };
  return (
    <span className={`badge ${info.variante}`}>
      <span className="badge__dot" aria-hidden="true" />
      {info.texto}
    </span>
  );
}

export function TenantsPage() {
  const { can } = useSession();
  const [data, setData] = useState<TenantListResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .call('platformTenants')
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const tenants = data?.tenants ?? [];

  return (
    <>
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Comunidades</h1>
          <p className="page-header__description">
            Todas as comunidades provisionadas nesta plataforma.
          </p>
        </div>
        <div className="page-header__actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Atualizar
          </button>
          {can('platform:tenant:create') && (
            <button
              type="button"
              className="btn btn--primary"
              aria-expanded={criando}
              onClick={() => setCriando((valor) => !valor)}
            >
              {criando ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
              {criando ? 'Fechar' : 'Nova comunidade'}
            </button>
          )}
        </div>
      </header>

      {criando && can('platform:tenant:create') && (
        <CreateTenantForm
          onCreated={() => {
            load();
            setCriando(false);
          }}
        />
      )}

      {loading && <TenantsSkeleton />}

      {!loading && error != null && <ErrorState error={error} onRetry={load} />}

      {!loading && error == null && (
        tenants.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon">
              <Building2 size={26} aria-hidden="true" />
            </span>
            <h2 className="empty-state__title">Nenhuma comunidade ainda</h2>
            <p className="empty-state__text">
              Assim que a primeira comunidade for criada, ela aparece nesta lista.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Comunidade</th>
                  <th scope="col">Identificador</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Criada em</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td className="table__primary">{tenant.name}</td>
                    <td>
                      <code className="slug">{tenant.slug}</code>
                    </td>
                    <td>
                      <SituacaoBadge status={tenant.status} />
                    </td>
                    <td>{formatDate(tenant.createdAt) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </>
  );
}

function TenantsSkeleton() {
  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        Carregando as comunidades.
      </p>
      <div className="table-wrap" aria-hidden="true">
        <table className="table">
          <tbody>
            {Array.from({ length: 5 }, (_, linha) => (
              <tr key={linha}>
                {Array.from({ length: 4 }, (_, coluna) => (
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

function CreateTenantForm({ onCreated }: { onCreated: () => void }) {
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setCreated(null);
    try {
      const result = await api.call('platformCreateTenant', { slug, name, ownerEmail });
      setCreated(result.slug);
      setSlug('');
      setName('');
      setOwnerEmail('');
      onCreated();
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card" style={{ marginBottom: 24 }}>
      <div className="card__header">
        <div>
          <h2 className="card__title">Criar comunidade</h2>
          <p className="card__subtitle">
            O identificador vira o endereço da vitrine.
          </p>
        </div>
      </div>

      <div className="card__body">
        {error != null && (
          <div className="alert alert--danger" role="alert" style={{ marginBottom: 20 }}>
            <AlertCircle className="alert__icon" size={18} aria-hidden="true" />
            <div className="alert__body">
              {error instanceof ApiClientError
                ? error.message
                : 'Não foi possível criar a comunidade.'}
            </div>
          </div>
        )}

        {created && (
          <div className="alert alert--success" role="status" style={{ marginBottom: 20 }}>
            <CheckCircle2 className="alert__icon" size={18} aria-hidden="true" />
            <div className="alert__body">
              Comunidade <code>{created}</code> criada. A marca padrão é provisionada pelo
              worker.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <fieldset className="fieldset" disabled={submitting}>
            <div className="field-grid">
              <div className="field">
                <label className="field__label" htmlFor="name">
                  Nome da comunidade <span className="field__required" aria-hidden="true">*</span>
                </label>
                <input
                  id="name"
                  className="field__input"
                  required
                  minLength={2}
                  maxLength={160}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              <div className="field">
                <label className="field__label" htmlFor="slug">
                  Identificador <span className="field__required" aria-hidden="true">*</span>
                </label>
                <input
                  id="slug"
                  className="field__input"
                  required
                  minLength={3}
                  maxLength={63}
                  pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?"
                  aria-describedby="dica-slug"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value.toLowerCase())}
                />
                <p className="field__hint" id="dica-slug">
                  Somente letras minúsculas, números e hífen. Vira{' '}
                  <code>{slug || '{identificador}'}.plataforma.com.br</code>.
                </p>
              </div>

              {/* DONO, obrigatorio.

                  Uma comunidade sem dono e uma comunidade que ninguem opera —
                  criada aqui e entregue a ninguem. O vinculo nasce na mesma
                  transacao da criacao: se este e-mail nao corresponder a uma
                  conta, nada e criado.

                  Conta EXISTENTE, e nao convite: convidar exige envio, token,
                  expiracao e tela de aceite. A pessoa se cadastra na vitrine e
                  o e-mail dela entra aqui. */}
              <div className="field">
                <label className="field__label" htmlFor="ownerEmail">
                  E-mail do dono <span className="field__required" aria-hidden="true">*</span>
                </label>
                <input
                  id="ownerEmail"
                  className="field__input"
                  type="email"
                  autoComplete="off"
                  required
                  maxLength={320}
                  aria-describedby="dica-owner"
                  value={ownerEmail}
                  onChange={(event) => setOwnerEmail(event.target.value)}
                />
                <p className="field__hint" id="dica-owner">
                  Precisa ser uma conta que já existe. Ela recebe o papel de dono desta
                  comunidade — e de nenhuma outra.
                </p>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {submitting ? <span className="btn__spinner" aria-hidden="true" /> : null}
                {submitting ? 'Criando…' : 'Criar comunidade'}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </section>
  );
}
