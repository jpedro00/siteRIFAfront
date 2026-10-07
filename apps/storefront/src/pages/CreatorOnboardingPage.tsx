import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Store } from 'lucide-react';
import { ApiClientError, RESERVED_COMMUNITY_SLUGS, type MembershipSummary } from '@clubedarifa/shared';
import { api } from '../api.ts';
import { Loading, mensagemPara } from '../components/States.tsx';
import { useDocumentMeta } from '../hooks/useDocumentMeta.ts';
import { ORGANIZER_URL, PLATFORM_NAME } from '../lib/mode.ts';
import { useStorefront } from '../state/SessionProvider.tsx';

/**
 * "Quero criar rifas": onboarding do criador.
 *
 * Nao existe segunda conta: a pessoa entra (ou se cadastra) com a MESMA conta de participante
 * e, ao criar a comunidade, recebe o vinculo OWNER. Criar comunidade, vinculo e marca acontece
 * numa transacao so no servidor, e repetir o envio nao duplica nada.
 */
const VOLTA = '/quero-criar-rifas';

/** "Rifas do João!" -> "rifas-do-joao" */
export function slugFromName(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

function slugProblem(slug: string): string | null {
  if (slug.length < 3) return 'O endereço precisa ter pelo menos 3 caracteres.';
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) return 'Use letras minúsculas, números e hífen (sem hífen no começo ou no fim).';
  if ((RESERVED_COMMUNITY_SLUGS as readonly string[]).includes(slug)) return 'Este endereço é reservado. Escolha outro.';
  return null;
}

function painelUrl(slug: string): string | null {
  return ORGANIZER_URL ? `${ORGANIZER_URL}/?comunidade=${encodeURIComponent(slug)}` : null;
}

function Passos() {
  return (
    <ol className="steps">
      <li>Crie sua conta (ou entre com a que você já tem).</li>
      <li>Dê um nome e um endereço à sua comunidade.</li>
      <li>Ative a verificação em duas etapas (obrigatória para criadores).</li>
      <li>Escolha o plano e conecte sua conta de recebimento.</li>
      <li>Crie sua primeira rifa no painel.</li>
    </ol>
  );
}

export function CreatorOnboardingPage() {
  const { sessionStatus, session, refreshSession } = useStorefront();
  useDocumentMeta({ title: `Quero criar rifas · ${PLATFORM_NAME}`, description: 'Crie sua comunidade e publique suas rifas no Clube da Rifa.' });

  const [nome, setNome] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEditado, setSlugEditado] = useState(false);
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [criada, setCriada] = useState<{ slug: string; name: string } | null>(null);
  const [outra, setOutra] = useState(false);

  if (sessionStatus === 'loading') {
    return (
      <div className="container page">
        <Loading label="Verificando sua sessão…" />
      </div>
    );
  }

  // Dono, financeiro e Super Admin precisam do segundo fator: a conta cuida disso e volta aqui.
  if (sessionStatus === 'mfa_required' || sessionStatus === 'mfa_enrollment_required') {
    return <Navigate to={`/conta?next=${encodeURIComponent(VOLTA)}`} replace />;
  }

  if (sessionStatus !== 'authenticated' || !session) {
    return (
      <div className="container page account">
        <div className="account__card card">
          <div className="card__body stack">
            <span className="account__icon">
              <Store size={22} aria-hidden="true" />
            </span>
            <h1 className="account__title">Crie e gerencie suas rifas</h1>
            <p className="muted">
              No {PLATFORM_NAME} cada criador tem a própria comunidade, o próprio painel e recebe direto na própria conta.
              Você usa a mesma conta para comprar e para criar.
            </p>
            <Passos />
            {sessionStatus === 'unavailable' && (
              <div className="alert alert--warning" role="status">
                <div className="alert__body">Não foi possível verificar sua sessão agora. Você ainda pode entrar ou criar a conta.</div>
              </div>
            )}
            <Link className="btn btn--primary btn--block" to={`/cadastro?next=${encodeURIComponent(VOLTA)}`}>
              Criar minha conta
            </Link>
            <Link className="btn btn--secondary btn--block" to={`/conta?next=${encodeURIComponent(VOLTA)}`}>
              Já tenho conta
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const donas: MembershipSummary[] = session.memberships.filter((m) => m.roles.includes('OWNER'));

  async function enviar(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    const problema = nome.trim().length < 2 ? 'Informe o nome da comunidade.' : slugProblem(slug);
    setErroLocal(problema);
    if (problema) return;

    setEnviando(true);
    try {
      const contact: { whatsapp?: string; email?: string } = {};
      if (whatsapp.trim()) contact.whatsapp = whatsapp.trim();
      if (email.trim()) contact.email = email.trim();
      const r = await api.call('createMyCommunity', {
        name: nome.trim(),
        slug,
        ...(Object.keys(contact).length > 0 ? { contact } : {}),
      });
      setCriada({ slug: r.slug, name: r.name });
      // A conta virou OWNER: a sessao passa a exigir o segundo fator e a tela segue a regra.
      await refreshSession();
    } catch (caught) {
      setErro(caught);
    } finally {
      setEnviando(false);
    }
  }

  if (criada) {
    const url = painelUrl(criada.slug);
    return (
      <div className="container page account">
        <div className="account__card card">
          <div className="card__body stack">
            <div className="alert alert--success" role="status">
              <CheckCircle2 className="alert__icon" size={18} aria-hidden="true" />
              <div className="alert__body">
                Comunidade <strong>{criada.name}</strong> criada. Você é a dona dela.
              </div>
            </div>
            <h1 className="account__title">Próximos passos</h1>
            <ol className="steps">
              <li>
                Ative a verificação em duas etapas: <Link to={`/conta?next=${encodeURIComponent(VOLTA)}`}>continuar</Link>.
              </li>
              <li>No painel, escolha o plano em <em>Minha assinatura</em>. Enquanto a cobrança de planos não estiver ativa, a tela informa a indisponibilidade; nada é cobrado nem simulado.</li>
              <li>Conecte sua conta do Mercado Pago em <em>Recebimentos</em>.</li>
              <li>Crie sua primeira rifa.</li>
            </ol>
            {url && (
              <a className="btn btn--primary btn--block" href={url}>
                Abrir painel do criador
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container page account">
      <div className="account__card card">
        <div className="card__body stack">
          <span className="account__icon">
            <Store size={22} aria-hidden="true" />
          </span>

          {donas.length > 0 && !outra ? (
            <>
              <h1 className="account__title">Você já é criador</h1>
              <ul className="stack">
                {donas.map((m) => {
                  const url = painelUrl(m.tenantSlug);
                  return (
                    <li key={m.tenantId} className="row row--between">
                      <span>{m.tenantName}</span>
                      {url ? (
                        <a className="btn btn--primary btn--sm" href={url}>
                          Abrir painel
                        </a>
                      ) : (
                        <span className="muted">/{m.tenantSlug}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <button type="button" className="btn btn--secondary btn--block" onClick={() => setOutra(true)}>
                Criar outra comunidade
              </button>
            </>
          ) : (
            <>
              <h1 className="account__title">Crie sua comunidade</h1>
              <p className="muted">Você entrou como {session.user.displayName}. Esta mesma conta passa a ser dona da comunidade.</p>

              {(erro != null || erroLocal) && (
                <div className="alert alert--danger" role="alert">
                  <AlertCircle className="alert__icon" size={18} aria-hidden="true" />
                  <div className="alert__body">
                    {erroLocal ??
                      (erro instanceof ApiClientError && erro.status === 409 && erro.message ? erro.message : mensagemPara(erro))}
                  </div>
                </div>
              )}

              <form className="stack" onSubmit={enviar}>
                <div className="field">
                  <label className="field__label" htmlFor="co-nome">
                    Nome da comunidade
                  </label>
                  <input
                    id="co-nome"
                    className="field__input"
                    required
                    maxLength={160}
                    value={nome}
                    onChange={(event) => {
                      setNome(event.target.value);
                      if (!slugEditado) setSlug(slugFromName(event.target.value));
                    }}
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="co-slug">
                    Endereço
                  </label>
                  <input
                    id="co-slug"
                    className="field__input"
                    required
                    maxLength={63}
                    value={slug}
                    onChange={(event) => {
                      setSlugEditado(true);
                      setSlug(event.target.value.toLowerCase());
                    }}
                  />
                  <p className="field__hint">Identifica sua página: /criador/{slug || 'seu-endereco'}. Não dá para mudar depois.</p>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="co-whatsapp">
                    WhatsApp <span className="muted">(opcional)</span>
                  </label>
                  <input id="co-whatsapp" className="field__input" maxLength={30} value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="co-email">
                    E-mail de contato <span className="muted">(opcional)</span>
                  </label>
                  <input id="co-email" className="field__input" type="email" maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
                <button type="submit" className="btn btn--primary btn--block" disabled={enviando}>
                  {enviando ? 'Criando…' : 'Criar comunidade'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
