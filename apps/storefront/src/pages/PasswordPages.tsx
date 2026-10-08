import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { api } from '../api.ts';
import { mensagemPara } from '../components/States.tsx';

/**
 * Recuperacao de senha (conta GLOBAL: o mesmo fluxo serve participante, dono e Super Admin).
 *
 * O pedido responde igual exista o e-mail ou nao, e a tela diz isso: nao ha como descobrir
 * quem tem conta. O token chega por e-mail e vem no FRAGMENTO do link (`#token=...`), que o
 * navegador nao envia ao servidor nem em Referer; a pagina o le, guarda so em memoria e o
 * remove da barra de enderecos.
 */
const MINIMO_SENHA = 10;

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<unknown>(null);

  async function enviar(event: FormEvent) {
    event.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      await api.call('forgotPassword', { email });
      setEnviado(true);
    } catch (caught) {
      setErro(caught);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="container page account">
      <div className="account__card card">
        <div className="card__body stack">
          <span className="account__icon">
            <KeyRound size={22} aria-hidden="true" />
          </span>
          <div>
            <h1 className="account__title">Esqueci minha senha</h1>
            <p className="muted">Informe o e-mail da sua conta para receber o link de redefinição.</p>
          </div>

          {enviado ? (
            <div className="alert alert--success" role="status">
              <CheckCircle2 className="alert__icon" size={18} aria-hidden="true" />
              <div className="alert__body">
                Se existir uma conta com esse e-mail, enviaremos o link de redefinição. O link vale por
                tempo limitado e só pode ser usado uma vez. Confira também a caixa de spam.
              </div>
            </div>
          ) : (
            <>
              {erro != null && (
                <div className="alert alert--danger" role="alert">
                  <AlertCircle className="alert__icon" size={18} aria-hidden="true" />
                  <div className="alert__body">{mensagemPara(erro)}</div>
                </div>
              )}
              <form className="stack" onSubmit={enviar}>
                <div className="field">
                  <label className="field__label" htmlFor="forgot-email">
                    E-mail
                  </label>
                  <input
                    id="forgot-email"
                    className="field__input"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn--primary btn--block" disabled={enviando || email.trim() === ''}>
                  {enviando ? 'Enviando…' : 'Enviar link'}
                </button>
              </form>
            </>
          )}

          <p className="muted account__note">
            <Link to="/conta">Voltar para entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/** O token do link: `#token=...`. Nunca na query (query vai para log de acesso). */
export function tokenFromHash(hash: string): string | null {
  const bruto = hash.startsWith('#') ? hash.slice(1) : hash;
  const valor = new URLSearchParams(bruto).get('token');
  return valor && valor.length >= 20 ? valor : null;
}

export function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [lido, setLido] = useState(false);
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  useEffect(() => {
    setToken(tokenFromHash(window.location.hash));
    setLido(true);
    // Tira o token da barra de enderecos e do historico.
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  async function enviar(event: FormEvent) {
    event.preventDefault();
    setErroLocal(null);
    setErro(null);
    if (senha.length < MINIMO_SENHA) {
      setErroLocal(`A senha precisa ter pelo menos ${MINIMO_SENHA} caracteres.`);
      return;
    }
    if (senha !== confirmacao) {
      setErroLocal('As senhas não coincidem.');
      return;
    }
    if (!token) return;
    setEnviando(true);
    try {
      await api.call('resetPassword', { token, password: senha, passwordConfirmation: confirmacao });
      setConcluido(true);
      setToken(null);
    } catch (caught) {
      setErro(caught);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="container page account">
      <div className="account__card card">
        <div className="card__body stack">
          <span className="account__icon">
            <KeyRound size={22} aria-hidden="true" />
          </span>
          <h1 className="account__title">Redefinir senha</h1>

          {concluido ? (
            <>
              <div className="alert alert--success" role="status">
                <CheckCircle2 className="alert__icon" size={18} aria-hidden="true" />
                <div className="alert__body">
                  Senha redefinida. Por segurança, todas as sessões abertas foram encerradas. Entre com a nova
                  senha.
                </div>
              </div>
              <Link className="btn btn--primary btn--block" to="/conta">
                Entrar
              </Link>
            </>
          ) : lido && !token ? (
            <>
              <div className="alert alert--danger" role="alert">
                <AlertCircle className="alert__icon" size={18} aria-hidden="true" />
                <div className="alert__body">Este link de redefinição é inválido ou está incompleto.</div>
              </div>
              <Link className="btn btn--secondary btn--block" to="/esqueci-senha">
                Pedir um novo link
              </Link>
            </>
          ) : (
            <>
              {(erro != null || erroLocal) && (
                <div className="alert alert--danger" role="alert">
                  <AlertCircle className="alert__icon" size={18} aria-hidden="true" />
                  <div className="alert__body">{erroLocal ?? mensagemPara(erro)}</div>
                </div>
              )}
              <form className="stack" onSubmit={enviar}>
                <div className="field">
                  <label className="field__label" htmlFor="reset-password">
                    Nova senha
                  </label>
                  <input
                    id="reset-password"
                    className="field__input"
                    type="password"
                    autoComplete="new-password"
                    minLength={MINIMO_SENHA}
                    required
                    value={senha}
                    onChange={(event) => setSenha(event.target.value)}
                  />
                  <p className="field__hint">Pelo menos {MINIMO_SENHA} caracteres.</p>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="reset-confirmation">
                    Confirmar nova senha
                  </label>
                  <input
                    id="reset-confirmation"
                    className="field__input"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmacao}
                    onChange={(event) => setConfirmacao(event.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn--primary btn--block" disabled={enviando || !token}>
                  {enviando ? 'Salvando…' : 'Redefinir senha'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
