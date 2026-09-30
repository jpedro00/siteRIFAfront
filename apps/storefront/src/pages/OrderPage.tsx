import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Clock, Hash, Printer, WifiOff, XCircle } from 'lucide-react';
import {
  formatCents,
  formatDateTime,
  formatNumberLabel,
  shortOrderReference,
  type OrderResponse,
} from '@clubedarifa/shared';
import { PixPayment } from '../components/PixPayment.tsx';
import { Loading, NotFoundState, mensagemPara } from '../components/States.tsx';
import { useApiPolling } from '../hooks/useApiPolling.ts';
import { useDocumentMeta } from '../hooks/useDocumentMeta.ts';
import { api } from '../api.ts';

/**
 * Comprovante e pagamento do pedido: `/pedido/:id`.
 *
 * E a tela em que a compra TERMINA, e por isso faz duas coisas: cobra (PIX) enquanto o
 * pedido esta pendente e vira comprovante quando ele e pago.
 *
 * O status e CONSULTADO a cada 3 segundos enquanto o pedido esta pendente — a pessoa
 * paga no app do banco e volta para esta aba, e o comprovante aparece sozinho, sem
 * recarregar. Pago ou cancelado, a consulta para: nao ha mais o que mudar.
 *
 * Tres estados, com significados bem diferentes para quem comprou:
 *   PENDENTE  · reservado, aguardando pagamento — o relogio ainda corre
 *   PAGO      · concluido, numeros sao seus (RN18: nao voltam a ser vendidos)
 *   CANCELADO · nao concluido, numeros liberados
 */
const APRESENTACAO: Record<
  OrderResponse['status'],
  { titulo: string; texto: string; classe: string; Icone: typeof CheckCircle2 }
> = {
  PENDENTE: {
    titulo: 'Falta pagar',
    texto:
      'Seus números estão reservados. Conclua o pagamento com PIX antes do fim do prazo, ' +
      'senão eles voltam a ficar disponíveis.',
    classe: 'receipt--pending',
    Icone: Clock,
  },
  PAGO: {
    titulo: 'Pagamento confirmado',
    texto: 'Seus números estão garantidos. Guarde este comprovante.',
    classe: 'receipt--paid',
    Icone: CheckCircle2,
  },
  CANCELADO: {
    titulo: 'Pedido cancelado',
    texto:
      'O prazo terminou sem pagamento e os números voltaram a ficar disponíveis. ' +
      'Você pode escolher outros números.',
    classe: 'receipt--cancelled',
    Icone: XCircle,
  },
};

const INTERVALO_MS = 3_000;

export function OrderPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [confirmando, setConfirmando] = useState(false);
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erroGerar, setErroGerar] = useState<string | null>(null);
  // Pago ou cancelado: nada mais muda, a consulta para.
  const [encerrado, setEncerrado] = useState(false);

  const pedido = useApiPolling<OrderResponse>(
    (signal) => api.call('publicOrder', undefined, { params: { id }, signal, revalidate: true }),
    [id],
    { intervalMs: INTERVALO_MS, enabled: !encerrado },
  );

  const order = pedido.data;

  useEffect(() => {
    if (order && order.status !== 'PENDENTE') setEncerrado(true);
  }, [order]);

  useDocumentMeta({
    title: order ? `Pedido #${shortOrderReference(order.orderId)} · ${order.drawTitle}` : 'Seu pedido',
  });

  /** Gera (ou devolve) o PIX. Idempotente no servidor: clicar duas vezes nao cobra duas vezes. */
  const gerarPix = useCallback(async () => {
    setGerando(true);
    setErroGerar(null);
    try {
      await api.call('publicOrderPayment', undefined, { params: { id } });
      pedido.reload();
    } catch (falha) {
      setErroGerar(mensagemPara(falha));
    } finally {
      setGerando(false);
    }
  }, [id, pedido]);

  /**
   * Confirmacao de pagamento SEM provedor — so no bundle de desenvolvimento.
   *
   * `import.meta.env.DEV` vira `false` no build de producao e o bloco inteiro sai na
   * eliminacao de codigo morto. A rota tambem se recusa a responder fora de
   * desenvolvimento, do lado do servidor: duas barreiras independentes para a mesma
   * coisa, porque uma so seria um botao que transforma pedido em pago sem cobrar.
   */
  const confirmarPagamento = useCallback(async () => {
    setConfirmando(true);
    setErroConfirmacao(null);
    try {
      await api.call('devConfirmPayment', undefined, { params: { id } });
      pedido.reload();
    } catch (falha) {
      setErroConfirmacao(mensagemPara(falha));
    } finally {
      setConfirmando(false);
    }
  }, [id, pedido]);

  if (pedido.status === 'loading') {
    return (
      <div className="container page">
        <Loading label="Carregando seu pedido…" />
      </div>
    );
  }

  if (pedido.status === 'error' || !order) {
    return (
      <div className="container page">
        <NotFoundState
          title="Pedido não encontrado"
          message="Não localizamos este pedido. Confira o link que você acessou."
          action={
            <Link className="btn btn--primary" to="/">
              Ir para o início
            </Link>
          }
        />
      </div>
    );
  }

  const { titulo, texto, classe, Icone } = APRESENTACAO[order.status];
  const criadoEm = formatDateTime(order.createdAt);
  const pagoEm = formatDateTime(order.paidAt);
  const referenciaCurta = shortOrderReference(order.orderId);

  return (
    <div className="container page receipt-page">
      <div className={`receipt ${classe}`}>
        {/* A mudanca de PENDENTE para PAGO e ANUNCIADA: quem paga no app do banco e volta
            aqui nao precisa procurar o que mudou. */}
        <header className="receipt__head" role="status" aria-live="polite">
          <span className="receipt__icon" aria-hidden="true">
            <Icone size={30} />
          </span>
          <h1 className="receipt__title">{titulo}</h1>
          <p className="receipt__text">{texto}</p>
        </header>

        {order.status === 'PENDENTE' && (
          <PixPayment
            order={order}
            stale={pedido.stale}
            generating={gerando}
            generateError={erroGerar}
            onGenerate={() => void gerarPix()}
          />
        )}

        {order.status !== 'PENDENTE' && pedido.stale && (
          <p className="alert alert--warning" role="status">
            <WifiOff className="alert__icon" size={16} aria-hidden="true" />
            <span className="alert__body">Sem conexão. Os dados abaixo podem estar desatualizados.</span>
          </p>
        )}

        <div className="receipt__numbers">
          <p className="receipt__numbers-label">
            <Hash size={14} aria-hidden="true" />
            {order.numbers.length === 1 ? 'Seu número' : `Seus ${order.numbers.length} números`}
          </p>
          <ul className="receipt__number-list">
            {order.numbers.map((valor) => (
              <li key={valor} className="receipt__number">
                {formatNumberLabel(valor, order.labelDigits)}
              </li>
            ))}
          </ul>
        </div>

        <dl className="receipt__details">
          <div className="receipt__row">
            <dt>Sorteio</dt>
            <dd>{order.drawTitle}</dd>
          </div>
          <div className="receipt__row">
            <dt>Participante</dt>
            <dd>{order.buyerName}</dd>
          </div>
          <div className="receipt__row">
            <dt>Valor por número</dt>
            <dd>{formatCents(order.unitPriceCents)}</dd>
          </div>
          <div className="receipt__row">
            <dt>Quantidade</dt>
            <dd>
              {order.quantity} {order.quantity === 1 ? 'número' : 'números'}
            </dd>
          </div>
          {criadoEm && (
            <div className="receipt__row">
              <dt>Pedido feito em</dt>
              <dd>{criadoEm}</dd>
            </div>
          )}
          {pagoEm && (
            <div className="receipt__row">
              <dt>Pagamento confirmado em</dt>
              <dd>{pagoEm}</dd>
            </div>
          )}
          <div className="receipt__row receipt__row--total">
            <dt>Total</dt>
            <dd>{formatCents(order.totalCents)}</dd>
          </div>
        </dl>

        <p className="receipt__code">
          <span className="receipt__reference">Pedido #{referenciaCurta}</span>
          <span className="receipt__code-hint">
            Guarde o endereço desta página para consultar seu pedido novamente.
          </span>
        </p>

        <div className="receipt__actions">
          {order.status === 'PAGO' && (
            <button type="button" className="btn btn--secondary" onClick={() => window.print()}>
              <Printer size={16} aria-hidden="true" />
              Salvar comprovante
            </button>
          )}
          <Link className="btn btn--ghost" to="/sorteios">
            Ver outros sorteios
          </Link>
        </div>
      </div>

      {import.meta.env.DEV && order.status === 'PENDENTE' && (
        <div className="dev-box">
          <p className="dev-box__label">Ambiente de desenvolvimento</p>
          <p className="dev-box__text">
            Sem provedor de pagamento configurado, este botão confirma o pedido diretamente. Ele
            não existe em produção.
          </p>
          {erroConfirmacao && (
            <p className="field__error" role="alert">
              {erroConfirmacao}
            </p>
          )}
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            disabled={confirmando}
            onClick={() => void confirmarPagamento()}
          >
            {confirmando ? <span className="btn__spinner" aria-hidden="true" /> : null}
            {confirmando ? 'Confirmando…' : 'Simular pagamento confirmado'}
          </button>
        </div>
      )}
    </div>
  );
}
