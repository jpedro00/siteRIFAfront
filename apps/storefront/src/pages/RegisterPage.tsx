import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, UserPlus } from 'lucide-react';
import { api } from '../api.ts';
import { useStorefront } from '../state/SessionProvider.tsx';
import { mensagemPara } from '../components/States.tsx';

/**
 * Criar conta: `/cadastro`.
 *
 * CONTA CONTINUA OPCIONAL. Ninguem precisa passar por aqui para participar de
 * um sorteio — o checkout sem conta segue funcionando e a propria tela diz
 * isso, para que a pessoa apressada nao ache que topou com um muro.
 *
 * DEPOIS DE CRIAR, ENTRA. O servidor nao abre sessao no cadastro: quem abre e
 * o `login`, com limitador por origem, trilha e a decisao de segundo fator num
 * lugar so. A tela chama os dois em sequencia, e a pessoa nao percebe a
 * diferenca — o que nao existe e um segundo caminho de autenticacao para
 * manter em dia.
 *
 * VALIDACAO. O formulario confere o obvio para nao gastar uma ida ao servidor
 * com o que ja da para ver; o SERVIDOR e a autoridade, e o mesmo schema de
 * contrato roda la. A conferencia local acontece no envio, nao a cada tecla:
 * marcar "senhas nao coincidem" enquanto a pessoa ainda esta digitando a
 * segunda acusa erro do que nao terminou.
 */
interface Erros {
  displayName?: string;
  email?: string;
  password?: string;
  passwordConfirmation?: string;
}

const MINIMO_SENHA = 10;

export function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useStorefront();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacao, setConfirmacao] = useState('');

  const [erros, setErros] = useState<Erros>({});
  const [jaEnviou, setJaEnviou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<unknown>(null);

  const resumoRef = useRef<HTMLDivElement>(null);

  function validar(): Erros {
    const encontrados: Erros = {};
    if (displayName.trim().length < 2) {
      encontrados.displayName = 'Informe seu nome.';
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      encontrados.email = 'Informe um e-mail válido.';
    }
    if (password.length < MINIMO_SENHA) {
      encontrados.password = `A senha precisa ter pelo menos ${MINIMO_SENHA} caracteres.`;
    }
    if (confirmacao !== password) {
      encontrados.passwordConfirmation = 'As senhas não coincidem.';
    }
    return encontrados;
  }

  function aoMudar(campo: keyof Erros, valor: string, set: (v: string) => void) {
    set(valor);
    // Depois da primeira tentativa a correcao e imediata: o erro ja foi
    // apontado e quem digita quer ver que resolveu.
    if (jaEnviou) setErros((atual) => ({ ...atual, [campo]: undefined }));
  }

  async function enviar(event: FormEvent) {
    event.preventDefault();
    if (enviando) return; // trava de clique duplo

    setJaEnviou(true);
    setErroEnvio(null);
    const encontrados = validar();
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) {
      resumoRef.current?.focus();
      return;
    }

    setEnviando(true);
    try {
      await api.call('register', {
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        passwordConfirmation: confirmacao,
      });

      // Conta criada: abre a sessao pelo caminho normal de login, que ja
      // recarrega o estado da sessao no provider.
      await login(email.trim(), password);
      navigate('/conta', { replace: true });
    } catch (caught) {
      setErroEnvio(caught);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="container page account">
      <div className="card account__card">
        <div className="card__body stack">
          <div>
            <h1 className="account__title">Criar conta</h1>
            <p className="muted">
              Com uma conta, seus pedidos ficam reunidos em um lugar só.
            </p>
          </div>

          {erroEnvio != null && (
            <div className="alert alert--danger" role="alert">
              <AlertCircle className="alert__icon" size={18} aria-hidden="true" />
              <div className="alert__body">
                <p>{mensagemPara(erroEnvio)}</p>
              </div>
            </div>
          )}

          {/* Resumo focavel: quem usa teclado ou leitor de tela descobre que o
              envio parou sem ter de caçar o campo vermelho. */}
          <div
            ref={resumoRef}
            tabIndex={-1}
            className={Object.keys(erros).length > 0 ? 'alert alert--danger' : 'sr-only'}
            role={Object.keys(erros).length > 0 ? 'alert' : undefined}
          >
            {Object.keys(erros).length > 0 && (
              <div className="alert__body">
                <p className="alert__title">Confira os campos destacados</p>
              </div>
            )}
          </div>

          <form className="stack" noValidate onSubmit={enviar}>
            <fieldset className="fieldset" disabled={enviando}>
              <div className="field">
                <label className="field__label" htmlFor="cadastro-nome">
                  Nome completo <span aria-hidden="true">*</span>
                </label>
                <input
                  id="cadastro-nome"
                  className="field__input"
                  type="text"
                  autoComplete="name"
                  required
                  value={displayName}
                  onChange={(e) => aoMudar('displayName', e.target.value, setDisplayName)}
                  aria-invalid={erros.displayName ? true : undefined}
                  aria-describedby={erros.displayName ? 'erro-cadastro-nome' : undefined}
                />
                {erros.displayName && (
                  <p className="field__error" id="erro-cadastro-nome">
                    {erros.displayName}
                  </p>
                )}
              </div>

              <div className="field">
                <label className="field__label" htmlFor="cadastro-email">
                  E-mail <span aria-hidden="true">*</span>
                </label>
                <input
                  id="cadastro-email"
                  className="field__input"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  value={email}
                  onChange={(e) => aoMudar('email', e.target.value, setEmail)}
                  aria-invalid={erros.email ? true : undefined}
                  aria-describedby={erros.email ? 'erro-cadastro-email' : undefined}
                />
                {erros.email && (
                  <p className="field__error" id="erro-cadastro-email">
                    {erros.email}
                  </p>
                )}
              </div>

              <div className="field">
                <label className="field__label" htmlFor="cadastro-senha">
                  Senha <span aria-hidden="true">*</span>
                </label>
                <input
                  id="cadastro-senha"
                  className="field__input"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => aoMudar('password', e.target.value, setPassword)}
                  aria-invalid={erros.password ? true : undefined}
                  aria-describedby={
                    erros.password ? 'erro-cadastro-senha' : 'dica-cadastro-senha'
                  }
                />
                {erros.password ? (
                  <p className="field__error" id="erro-cadastro-senha">
                    {erros.password}
                  </p>
                ) : (
                  <p className="field__hint" id="dica-cadastro-senha">
                    Pelo menos {MINIMO_SENHA} caracteres.
                  </p>
                )}
              </div>

              <div className="field">
                <label className="field__label" htmlFor="cadastro-confirmacao">
                  Repita a senha <span aria-hidden="true">*</span>
                </label>
                <input
                  id="cadastro-confirmacao"
                  className="field__input"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmacao}
                  onChange={(e) =>
                    aoMudar('passwordConfirmation', e.target.value, setConfirmacao)
                  }
                  aria-invalid={erros.passwordConfirmation ? true : undefined}
                  aria-describedby={
                    erros.passwordConfirmation ? 'erro-cadastro-confirmacao' : undefined
                  }
                />
                {erros.passwordConfirmation && (
                  <p className="field__error" id="erro-cadastro-confirmacao">
                    {erros.passwordConfirmation}
                  </p>
                )}
              </div>
            </fieldset>

            <button className="btn btn--primary btn--lg" type="submit" disabled={enviando}>
              <UserPlus size={18} aria-hidden="true" />
              {enviando ? 'Criando sua conta…' : 'Criar conta'}
            </button>
          </form>

          <p className="muted account__note">
            Já tem uma conta? <Link to="/conta">Entrar</Link>
          </p>
          <p className="muted account__note">
            Você não precisa de conta para participar de um sorteio.{' '}
            <Link to="/sorteios">Ver sorteios</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
