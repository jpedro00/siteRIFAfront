import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, Ticket } from 'lucide-react';
import {
  formatCents,
  formatDateTime,
  formatNumberLabel,
  shortOrderReference,
  type AccountOrder,
} from '@campaigns/shared';
import { api } from '../api.ts';
import { ErrorState, Loading } from './States.tsx';

/**
 * Pedidos da conta, agrupados por comunidade.
 *
 * DE ONDE VEM A LISTA. De `GET /api/account/orders`, que decide o dono pela
 * SESSAO. Esta tela nao manda e-mail, telefone nem id nenhum para pedir os
 * pedidos — nao ha como pedir os de outra pessoa porque nao ha onde dizer de
 * quem. Se houvesse um parametro, ele seria o alvo.
 *
 * AGRUPAMENTO E DE APRESENTACAO. A API devolve uma lista plana em ordem
 * cronologica, que e o que pagina bem. Quem participa de tres comunidades le
 * melhor separado por comunidade, e essa reorganizacao acontece aqui, sem
 * pedir nada a mais ao servidor.
 *
 * PAGINA SOB DEMANDA. A conta de quem compra toda semana cresce sem limite;
 * carregar tudo de uma vez seria uma tela que piora com o tempo de uso. O
 * cursor vem do servidor e volta como veio.
 */
const POR_PAGINA = 20;

/**
 * Status do PEDIDO — vocabulario proprio, diferente do status do sorteio.
 * `StatusBadge` fala de sorteio ("Vendas abertas"); reaproveita-lo aqui
 * misturaria duas maquinas de estado que so por acaso cabem numa pilula.
 */
const APRESENTACAO_STATUS: Record<AccountOrder['status'], { texto: string; classe: string }> = {
  PENDENTE: { texto: 'Aguardando pagamento', classe: 'badge--warning' },
  PAGO: { texto: 'Pago', classe: 'badge--success' },
  CANCELADO: { texto: 'Cancelado', classe: 'badge--neutral' },
};

interface Grupo {
  readonly tenantSlug: string;
  readonly tenantName: string;
  readonly pedidos: AccountOrder[];
}

function agrupar(pedidos: readonly AccountOrder[]): Grupo[] {
  const porComunidade = new Map<string, Grupo>();
  for (const pedido of pedidos) {
    const atual = porComunidade.get(pedido.tenantSlug);
    if (atual) {
      atual.pedidos.push(pedido);
    } else {
      porComunidade.set(pedido.tenantSlug, {
        tenantSlug: pedido.tenantSlug,
        tenantName: pedido.tenantName,
        pedidos: [pedido],
      });
    }
  }
  return [...porComunidade.values()];
}

export function AccountOrders() {
  const [pedidos, setPedidos] = useState<AccountOrder[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [erro, setErro] = useState<unknown>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);

  const carregar = useCallback(async (proximo: string | null) => {
    const resposta = await api.call('accountOrders', undefined, {
      query: proximo
        ? { limit: String(POR_PAGINA), cursor: proximo }
        : { limit: String(POR_PAGINA) },
    });
    return resposta;
  }, []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const resposta = await carregar(null);
        if (!ativo) return;
        setPedidos(resposta.orders);
        setCursor(resposta.nextCursor);
        setStatus('ready');
      } catch (caught) {
        if (!ativo) return;
        setErro(caught);
        setStatus('error');
      }
    })();
    return () => {
      ativo = false;
    };
  }, [carregar]);

  async function verMais() {
    if (!cursor || carregandoMais) return;
    setCarregandoMais(true);
    try {
      const resposta = await carregar(cursor);
      setPedidos((atuais) => [...atuais, ...resposta.orders]);
      setCursor(resposta.nextCursor);
    } catch (caught) {
      setErro(caught);
    } finally {
      setCarregandoMais(false);
    }
  }

  if (status === 'loading') return <Loading label="Carregando suas participações…" />;

  if (status === 'error') {
    return (
      <ErrorState
        error={erro}
        title="Não foi possível carregar suas participações"
        onRetry={() => {
          setStatus('loading');
          setErro(null);
          void carregar(null).then(
            (r) => {
              setPedidos(r.orders);
              setCursor(r.nextCursor);
              setStatus('ready');
            },
            (e) => {
              setErro(e);
              setStatus('error');
            },
          );
        }}
      />
    );
  }

  if (pedidos.length === 0) {
    return (
      <div className="card">
        <div className="card__body empty-state">
          <span className="empty-state__icon">
            <Ticket size={26} aria-hidden="true" />
          </span>
          <h3 className="empty-state__title">Você ainda não tem participações</h3>
          <p className="empty-state__text">
            Quando você participar de um sorteio com a conta aberta, ele aparece aqui.
          </p>
          <Link className="btn btn--primary" to="/sorteios">
            Ver sorteios
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stack stack--lg">
      {agrupar(pedidos).map((grupo) => (
        <section key={grupo.tenantSlug} className="account-group">
          <h3 className="account-group__title">{grupo.tenantName}</h3>

          <ul className="account-group__list">
            {grupo.pedidos.map((pedido) => (
              <li key={pedido.orderId} className="card account-order">
                <div className="card__body stack stack--sm">
                  <div className="row row--between account-order__head">
                    <div>
                      <p className="account-order__draw">{pedido.drawTitle}</p>
                      <p className="muted account-order__ref">
                        Pedido #{shortOrderReference(pedido.orderId)}
                      </p>
                    </div>
                    <span className={`badge ${APRESENTACAO_STATUS[pedido.status].classe}`}>
                      {APRESENTACAO_STATUS[pedido.status].texto}
                    </span>
                  </div>

                  <ul className="chip-list chip-list--static">
                    {pedido.numbers.map((numero) => (
                      <li key={numero} className="chip chip--static">
                        {formatNumberLabel(numero, pedido.labelDigits)}
                      </li>
                    ))}
                  </ul>

                  <div className="row row--between account-order__foot">
                    <span className="muted">
                      {pedido.quantity} {pedido.quantity === 1 ? 'número' : 'números'} ·{' '}
                      {formatDateTime(pedido.createdAt)}
                    </span>
                    <strong>{formatCents(pedido.totalCents)}</strong>
                  </div>

                  <Link className="btn btn--secondary btn--sm" to={`/pedido/${pedido.orderId}`}>
                    <Receipt size={15} aria-hidden="true" />
                    Ver comprovante
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {cursor && (
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => void verMais()}
          disabled={carregandoMais}
        >
          {carregandoMais ? 'Carregando…' : 'Ver mais participações'}
        </button>
      )}
    </div>
  );
}
