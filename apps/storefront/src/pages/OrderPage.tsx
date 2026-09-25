import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Clock, Hash, Printer, XCircle } from 'lucide-react';
import {
  formatCents,
  formatDateTime,
  formatNumberLabel,
  shortOrderReference,
  type OrderResponse,
} from '@campaigns/shared';
import { ReservationTimer } from '../components/ReservationTimer.tsx';
import { Loading, NotFoundState, mensagemPara } from '../components/States.tsx';
import { useApiResource } from '../hooks/useApiResource.ts';
import { api } from '../api.ts';

/**
 * Comprovante do pedido: `/pedido/:id`.
 *
 * Esta e a ultima tela da compra e precisa PARECER um comprovante — numeros
 * grandes, dados conferiveis, data e hora. Devolver um JSON, um "sucesso!"
 * generico ou um identificador tecnico solto seria desperdicar o momento em
 * que a confianca esta mais alta.
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
    titulo: 'Pedido registrado',
    // "Conclua o pagamento" mandava fazer algo que a tela nao oferece: nao ha
    // provedor de pagamento integrado, entao nao existe botao, codigo nem
    // instrucao a seguir aqui. Instruir uma acao impossivel e pior do que nao
    // instruir nada — a pessoa procura, nao acha, e conclui que o site
    // quebrou. O texto diz o que de fato vale: os numeros estao presos ate o
    // prazo, e o combinado de pagamento e com a organizacao da comunidade.
    texto:
      'Seus números estão reservados até o fim do prazo. O pagamento é combinado ' +
      'diretamente com a organização da comunidade.',
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
    texto: 'Este pedido não foi concluído e os números voltaram a ficar disponíveis.',
    classe: 'receipt--cancelled',
    Icone: XCircle,
  },
};

export function OrderPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [confirmando, setConfirmando] = useState(false);
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null);

  const pedido = useApiResource<OrderResponse>(
    (signal) => api.call('publicOrder', undefined, { params: { id }, signal }),
    [id],
  );

  /**
   * Confirmacao de pagamento SEM provedor.
   *
   * So existe no bundle de desenvolvimento: `import.meta.env.DEV` e trocado
   * por `false` no build de producao e o bloco inteiro sai na eliminacao de
   * codigo morto — o botao nao chega ao navegador de ninguem. A rota tambem
   * se recusa a responder fora de desenvolvimento, do lado do servidor. Sao
   * duas barreiras independentes para a mesma coisa, porque uma delas sozinha
   * seria um botao que transforma pedido em pago sem cobrar.
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
        <Loading label="Carregando seu comprovante…" />
      </div>
    );
  }

  if (pedido.status === 'error') {
    return (
      <div className="container page">
        <NotFoundState
          title="Comprovante não encontrado"
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

  const order = pedido.data!;
  const { titulo, texto, classe, Icone } = APRESENTACAO[order.status];
  const criadoEm = formatDateTime(order.createdAt);
  const pagoEm = formatDateTime(order.paidAt);

  // Referencia curta para leitura humana; a regra mora em @campaigns/shared.
  const referenciaCurta = shortOrderReference(order.orderId);

  return (
    <div className="container page receipt-page">
      <div className={`receipt ${classe}`}>
        <header className="receipt__head">
          <span className="receipt__icon" aria-hidden="true">
            <Icone size={30} />
          </span>
          <h1 className="receipt__title">{titulo}</h1>
          <p className="receipt__text">{texto}</p>

          {order.status === 'PENDENTE' && order.expiresAt && (
            <ReservationTimer expiresAt={order.expiresAt} />
          )}
        </header>

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
          {/* Some na impressao: no papel nao existe endereco para guardar. */}
          <span className="receipt__code-hint">
            Guarde o endereço desta página para consultar seu pedido novamente.
          </span>
        </p>

        <div className="receipt__actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => window.print()}
          >
            <Printer size={16} aria-hidden="true" />
            Salvar comprovante
          </button>
          <Link className="btn btn--ghost" to="/sorteios">
            Ver outros sorteios
          </Link>
        </div>
      </div>

      {import.meta.env.DEV && order.status === 'PENDENTE' && (
        <div className="dev-box">
          <p className="dev-box__label">Ambiente de desenvolvimento</p>
          <p className="dev-box__text">
            Não há provedor de pagamento nesta fase. Este botão confirma o pedido diretamente e
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
