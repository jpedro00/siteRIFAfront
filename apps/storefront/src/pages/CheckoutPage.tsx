import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Lock } from 'lucide-react';
import { formatPhoneBR, phoneDigits } from '@campaigns/shared';
import { CheckoutSummary } from '../components/CheckoutSummary.tsx';
import { ReservationTimer } from '../components/ReservationTimer.tsx';
import { NotFoundState, mensagemPara } from '../components/States.tsx';
import { clearReservation, loadReservation } from '../lib/reservationStore.ts';
import { api } from '../api.ts';

/**
 * Checkout: `/sorteio/:slug/checkout`.
 *
 * A reserva JA existe quando esta tela abre — os numeros estao bloqueados e o
 * relogio esta correndo. Por isso a tela e curta: tres campos e um aceite.
 * Cada campo a mais aqui e uma chance a mais de a reserva vencer no meio do
 * preenchimento.
 *
 * VALIDACAO
 * ---------
 * Acontece na hora do envio, nao a cada tecla. Um campo que fica vermelho
 * enquanto a pessoa ainda esta digitando o nome acusa erro de algo que ainda
 * nao terminou. Depois da primeira tentativa, ai sim a correcao e imediata:
 * a essa altura o erro ja foi apontado e a pessoa quer ver que resolveu.
 */

interface ErrosFormulario {
  name?: string;
  phone?: string;
  email?: string;
  terms?: string;
}

export function CheckoutPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const guardada = useMemo(() => loadReservation(), []);

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [aceite, setAceite] = useState(false);
  const [erros, setErros] = useState<ErrosFormulario>({});
  const [jaEnviou, setJaEnviou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [expirou, setExpirou] = useState(false);

  const validar = useCallback((): ErrosFormulario => {
    const encontrados: ErrosFormulario = {};

    if (nome.trim().length < 2) {
      encontrados.name = 'Informe seu nome completo.';
    }

    const digitos = phoneDigits(telefone);
    if (digitos.length < 10) {
      encontrados.phone = 'Informe um telefone com DDD, como (11) 98888-7777.';
    }

    // E-mail e opcional; so e validado se tiver sido preenchido.
    if (email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      encontrados.email = 'Confira o e-mail digitado.';
    }

    if (!aceite) {
      encontrados.terms = 'É preciso aceitar as regras para continuar.';
    }

    return encontrados;
  }, [aceite, email, nome, telefone]);

  const revalidar = useCallback(() => {
    if (jaEnviou) setErros(validar());
  }, [jaEnviou, validar]);

  const enviar = useCallback(async () => {
    if (!guardada) return;

    setJaEnviou(true);
    const encontrados = validar();
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) {
      // Leva o foco ao primeiro campo com problema: sem isso, num formulario
      // rolado, a pessoa so ve o botao nao responder.
      const primeiro = Object.keys(encontrados)[0];
      document.getElementById(`campo-${primeiro}`)?.focus();
      return;
    }

    setEnviando(true);
    setErroEnvio(null);

    try {
      const pedido = await api.call('createOrder', {
        reservationId: guardada.reservation.reservationId,
        buyer: {
          name: nome.trim(),
          phone: phoneDigits(telefone),
          ...(email.trim() === '' ? {} : { email: email.trim() }),
        },
        acceptedTerms: true,
      });

      clearReservation();
      navigate(`/pedido/${pedido.orderId}`, { replace: true });
    } catch (falha) {
      setErroEnvio(mensagemPara(falha));
    } finally {
      setEnviando(false);
    }
  }, [email, guardada, navigate, nome, telefone, validar]);

  // -------------------------------------------------------------------------
  // Sem reserva em memoria: recarregou a pagina depois de a reserva vencer, ou
  // chegou aqui por um link direto. A tela nao acusa erro — explica e devolve
  // a pessoa a grade, que e o unico caminho util daqui.
  if (!guardada) {
    return (
      <div className="container page">
        <NotFoundState
          title="Não encontramos sua reserva"
          message="Sua reserva pode ter expirado ou esta página foi aberta fora do fluxo de compra. Escolha seus números novamente."
          action={
            <Link className="btn btn--primary" to={slug ? `/sorteio/${slug}` : '/sorteios'}>
              Escolher números
            </Link>
          }
        />
      </div>
    );
  }

  const { reservation, drawTitle, labelDigits } = guardada;

  return (
    <div className="container page checkout">
      <Link className="back-link" to={`/sorteio/${guardada.drawSlug}`}>
        <ArrowLeft size={16} aria-hidden="true" />
        Voltar ao sorteio
      </Link>

      <header className="checkout__header">
        <h1 className="page__title">Finalizar compra</h1>
        <ReservationTimer
          expiresAt={reservation.expiresAt}
          onExpire={() => setExpirou(true)}
        />
      </header>

      {expirou && (
        <div className="alert alert--danger" role="alert">
          <AlertCircle className="alert__icon" size={18} aria-hidden="true" />
          <div className="alert__body">
            <p className="alert__title">Sua reserva expirou</p>
            <p>
              Os números voltaram a ficar disponíveis para outras pessoas.{' '}
              <Link to={`/sorteio/${guardada.drawSlug}`}>Escolher novamente</Link>.
            </p>
          </div>
        </div>
      )}

      <div className="checkout__layout">
        <form
          className="checkout__form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void enviar();
          }}
        >
          <fieldset className="fieldset" disabled={enviando || expirou}>
            <legend className="fieldset__legend">Seus dados</legend>
            <p className="fieldset__caption">
              Usamos estes dados para identificar sua compra e entrar em contato caso você seja
              sorteado.
            </p>

            <div className={`field${erros.name ? ' field--invalid' : ''}`}>
              <label className="field__label" htmlFor="campo-name">
                Nome completo <span className="field__required" aria-hidden="true">*</span>
              </label>
              <input
                id="campo-name"
                className="field__input"
                type="text"
                autoComplete="name"
                required
                value={nome}
                aria-invalid={erros.name ? true : undefined}
                aria-describedby={erros.name ? 'erro-name' : undefined}
                onChange={(event) => setNome(event.target.value)}
                onBlur={revalidar}
              />
              {erros.name && (
                <p className="field__error" id="erro-name">
                  <AlertCircle size={14} aria-hidden="true" />
                  {erros.name}
                </p>
              )}
            </div>

            <div className={`field${erros.phone ? ' field--invalid' : ''}`}>
              <label className="field__label" htmlFor="campo-phone">
                Telefone com DDD <span className="field__required" aria-hidden="true">*</span>
              </label>
              <input
                id="campo-phone"
                className="field__input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                placeholder="(11) 98888-7777"
                value={telefone}
                aria-invalid={erros.phone ? true : undefined}
                aria-describedby={erros.phone ? 'erro-phone' : 'dica-phone'}
                onChange={(event) => setTelefone(formatPhoneBR(event.target.value))}
                onBlur={revalidar}
              />
              {erros.phone ? (
                <p className="field__error" id="erro-phone">
                  <AlertCircle size={14} aria-hidden="true" />
                  {erros.phone}
                </p>
              ) : (
                <p className="field__hint" id="dica-phone">
                  É por aqui que a organização entra em contato com o ganhador.
                </p>
              )}
            </div>

            <div className={`field${erros.email ? ' field--invalid' : ''}`}>
              <label className="field__label" htmlFor="campo-email">
                E-mail <span className="muted">(opcional)</span>
              </label>
              <input
                id="campo-email"
                className="field__input"
                type="email"
                autoComplete="email"
                value={email}
                aria-invalid={erros.email ? true : undefined}
                aria-describedby={erros.email ? 'erro-email' : undefined}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={revalidar}
              />
              {erros.email && (
                <p className="field__error" id="erro-email">
                  <AlertCircle size={14} aria-hidden="true" />
                  {erros.email}
                </p>
              )}
            </div>

            <div className={`field${erros.terms ? ' field--invalid' : ''}`}>
              <label className="checkbox" htmlFor="campo-terms">
                <input
                  id="campo-terms"
                  className="checkbox__input"
                  type="checkbox"
                  checked={aceite}
                  aria-invalid={erros.terms ? true : undefined}
                  aria-describedby={erros.terms ? 'erro-terms' : undefined}
                  onChange={(event) => {
                    const marcado = event.target.checked;
                    setAceite(marcado);
                    /*
                     * O erro e resolvido AQUI, e nao por `validar()`.
                     *
                     * `validar` e memorizado sobre o `aceite` desta
                     * renderizacao: chamado de dentro do proprio onChange, ele
                     * ainda enxerga o valor ANTERIOR, e a mensagem "e preciso
                     * aceitar as regras" continuaria na tela depois de a
                     * pessoa ter marcado a caixa — exatamente o tipo de erro
                     * fantasma que faz alguem desistir do formulario.
                     */
                    if (jaEnviou) {
                      setErros((anteriores) => {
                        const proximos = { ...anteriores };
                        if (marcado) delete proximos.terms;
                        else proximos.terms = 'É preciso aceitar as regras para continuar.';
                        return proximos;
                      });
                    }
                  }}
                />
                <span className="checkbox__text">
                  Li e aceito as regras do sorteio. Confirmo que tenho 18 anos ou mais.
                </span>
              </label>
              {erros.terms && (
                <p className="field__error" id="erro-terms">
                  <AlertCircle size={14} aria-hidden="true" />
                  {erros.terms}
                </p>
              )}
            </div>
          </fieldset>

          {erroEnvio && (
            <div className="alert alert--danger" role="alert">
              <AlertCircle className="alert__icon" size={18} aria-hidden="true" />
              <div className="alert__body">{erroEnvio}</div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn--primary btn--lg btn--block"
            disabled={enviando || expirou}
          >
            {enviando ? <span className="btn__spinner" aria-hidden="true" /> : null}
            {enviando ? 'Confirmando…' : 'Confirmar pedido'}
          </button>

          <p className="checkout__note">
            <Lock size={13} aria-hidden="true" />
            Seus dados são usados apenas para identificar esta compra.
          </p>
        </form>

        <aside className="checkout__aside">
          <CheckoutSummary
            drawTitle={drawTitle}
            numbers={reservation.numbers}
            labelDigits={labelDigits}
            unitPriceCents={reservation.unitPriceCents}
            totalCents={reservation.totalCents}
          />
        </aside>
      </div>
    </div>
  );
}
