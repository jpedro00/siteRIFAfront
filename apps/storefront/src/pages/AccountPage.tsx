import { useState, type FormEvent } from 'react';
import { AlertCircle, LogOut, ShieldCheck } from 'lucide-react';
import { initialsOf } from '@campaigns/shared';
import { useStorefront } from '../state/SessionProvider.tsx';
import { Loading, mensagemPara } from '../components/States.tsx';

/**
 * Minha conta.
 *
 * Usa as MESMAS rotas de identidade do restante da plataforma. Nao ha usuario
 * fixo, token permanente nem estado do navegador fazendo as vezes de
 * autenticacao: o cookie de sessao e httpOnly e o servidor decide.
 *
 * O historico de compras ainda nao existe — nao ha vinculo entre comprador e
 * conta nesta fatia, so entre comprador e pedido. A tela diz isso em
 * linguagem de produto ("o comprovante e o seu registro") em vez de anunciar
 * uma fase de desenvolvimento, que nao significa nada para quem comprou.
 */
export function AccountPage() {
  const { sessionStatus, session, login, verifyMfa, logout } = useStorefront();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await verifyMfa(code);
    } catch (caught) {
      setError(caught);
      setCode('');
    } finally {
      setSubmitting(false);
    }
  }

  if (sessionStatus === 'loading') {
    return (
      <div className="container page">
        <Loading label="Verificando sua sessão…" />
      </div>
    );
  }

  // ---------------------------------------------------------------- MFA ---
  if (sessionStatus === 'mfa_required') {
    return (
      <div className="container page account">
        <div className="account__card card">
          <div className="card__body stack">
            <span className="account__icon">
              <ShieldCheck size={22} aria-hidden="true" />
            </span>
            <div>
              <h1 className="account__title">Verificação em duas etapas</h1>
              <p className="muted">
                Digite o código de 6 dígitos do seu aplicativo autenticador.
              </p>
            </div>

            {error != null && (
              <div className="alert alert--danger" role="alert">
                <AlertCircle className="alert__icon" size={18} aria-hidden="true" />
                <div className="alert__body">{mensagemPara(error)}</div>
              </div>
            )}

            <form className="stack" onSubmit={handleVerify}>
              <div className="field">
                <label className="field__label" htmlFor="code">
                  Código de verificação
                </label>
                <input
                  id="code"
                  className="field__input account__code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                />
              </div>

              <button
                type="submit"
                className="btn btn--primary btn--block"
                disabled={submitting || code.length !== 6}
              >
                {submitting ? <span className="btn__spinner" aria-hidden="true" /> : null}
                {submitting ? 'Verificando…' : 'Verificar'}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--block"
                onClick={() => void logout()}
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------ logado ---
  if (sessionStatus === 'authenticated' && session) {
    return (
      <div className="container page account">
        <h1 className="page__title">Minha conta</h1>

        <div className="card account__profile">
          <div className="card__body row row--between">
            <div className="row">
              <span className="account__avatar" aria-hidden="true">
                {initialsOf(session.user.displayName)}
              </span>
              <div>
                <p className="account__name">{session.user.displayName}</p>
                <p className="muted">{session.user.email}</p>
              </div>
            </div>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => void logout()}
            >
              <LogOut size={15} aria-hidden="true" />
              Sair
            </button>
          </div>
        </div>

        <p className="muted account__note">
          Para consultar um pedido, guarde o endereço do comprovante recebido ao finalizar.
        </p>
      </div>
    );
  }

  // ------------------------------------------------------------- entrar ---
  return (
    <div className="container page account">
      <div className="account__card card">
        <div className="card__body stack">
          <div>
            <h1 className="account__title">Entrar</h1>
            <p className="muted">Entre para ver seu perfil nesta comunidade.</p>
          </div>

          {error != null && (
            <div className="alert alert--danger" role="alert">
              <AlertCircle className="alert__icon" size={18} aria-hidden="true" />
              <div className="alert__body">{mensagemPara(error)}</div>
            </div>
          )}

          <form className="stack" onSubmit={handleLogin}>
            <div className="field">
              <label className="field__label" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                className="field__input"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="password">
                Senha
              </label>
              <input
                id="password"
                className="field__input"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
              {submitting ? <span className="btn__spinner" aria-hidden="true" /> : null}
              {submitting ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="muted account__note">
            Para participar de um sorteio você não precisa de conta: seus dados são pedidos na
            hora da compra.
          </p>
        </div>
      </div>
    </div>
  );
}
