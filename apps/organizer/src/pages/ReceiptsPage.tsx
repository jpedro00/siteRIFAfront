import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Landmark } from 'lucide-react';
import {
  ApiClientError,
  formatDateTime,
  type PaymentAccount,
  type PaymentAccountsResponse,
} from '@clubedarifa/shared';
import { api } from '../api.ts';
import { ConfirmPanel, Notice, ToneBadge } from '../components/BillingUi.tsx';
import { EmptyState, ErrorPanel, MetricsSkeleton, PageHeader } from '../components/Ui.tsx';
import { useApiResource } from '../hooks/useApiResource.ts';
import {
  SWAP_NOTICE,
  describeAccount,
  environmentLabel,
  maskAccountId,
  readOAuthReturn,
  type OAuthReturn,
} from '../lib/billingCopy.ts';
import { redirectTo } from '../lib/navigate.ts';
import { useSession } from '../state/SessionProvider.tsx';

/**
 * Recebimentos (Fase 7 · FLUXO B: a conta do Mercado Pago que recebe o dinheiro dos
 * PARTICIPANTES).
 *
 * A conexao e sempre a autorizacao oficial do Mercado Pago (OAuth): esta tela nunca pede
 * Access Token, Client Secret nem nenhuma credencial, e a API nunca devolve uma. O que
 * aparece daqui e so o estado da conexao e um identificador mascarado.
 *
 * O retorno do OAuth chega em `?conexao=ok|erro&motivo=...`: a tela le UMA vez, mostra o
 * resultado traduzido (motivo desconhecido vira texto generico) e limpa a URL para que um
 * F5 ou o botao "voltar" nao repita o aviso.
 */

type Confirmacao = { tipo: 'desconectar' | 'trocar'; conta: PaymentAccount } | null;

export function ReceiptsPage() {
  const { can } = useSession();
  const podeGerir = can('payment_account:manage');

  const contas = useApiResource<PaymentAccountsResponse>((signal) => api.call('tenantPaymentAccounts', undefined, { signal }), []);

  const [params, setParams] = useSearchParams();
  const [retorno, setRetorno] = useState<OAuthReturn>({ kind: 'none' });
  const retornoLido = useRef(false);

  useEffect(() => {
    if (retornoLido.current) return;
    const lido = readOAuthReturn(params);
    if (lido.kind === 'none') return;
    retornoLido.current = true;
    setRetorno(lido);
    // Remove `conexao` e `motivo` da URL e do historico (replace, nao push).
    setParams({}, { replace: true });
    if (lido.kind === 'ok') contas.reload();
    // Roda so na chegada: `params` muda logo depois de limpar a URL (a trava e o `retornoLido`).
  }, []);

  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<Confirmacao>(null);
  const desconectarRef = useRef<HTMLButtonElement>(null);
  const trocarRef = useRef<HTMLButtonElement>(null);

  const conectar = async () => {
    setOcupado(true);
    setErro(null);
    setResultado(null);
    setRetorno({ kind: 'none' });
    try {
      const { url } = await api.call('connectPaymentAccount', { provider: 'MERCADO_PAGO' });
      redirectTo(url);
    } catch (falha) {
      setErro(falha instanceof ApiClientError ? falha.message : 'Não foi possível iniciar a conexão. Tente novamente.');
      setOcupado(false);
      setConfirmacao(null);
    }
  };

  const desconectar = async (conta: PaymentAccount) => {
    setOcupado(true);
    setErro(null);
    setResultado(null);
    try {
      const atual = await api.call('disconnectPaymentAccount', undefined, { params: { id: conta.id } });
      setConfirmacao(null);
      setResultado(
        atual.status === 'DISCONNECTING'
          ? 'Desconexão iniciada. A conta não aceita mais novos pagamentos e será encerrada quando as operações em andamento terminarem.'
          : 'Conta desconectada.',
      );
      contas.reload();
    } catch (falha) {
      setErro(falha instanceof ApiClientError ? falha.message : 'Não foi possível desconectar a conta. Tente novamente.');
    } finally {
      setOcupado(false);
    }
  };

  if (contas.status === 'loading') {
    return (
      <>
        <PageHeader title="Recebimentos" />
        <MetricsSkeleton count={2} />
      </>
    );
  }
  if (contas.status === 'error' || !contas.data) {
    return (
      <>
        <PageHeader title="Recebimentos" />
        <ErrorPanel error={contas.error} onRetry={contas.reload} title="Não foi possível carregar os recebimentos" />
      </>
    );
  }

  const { enabled, accounts } = contas.data;
  const ordenadas = [...accounts].sort((a, b) => b.connectedAt.localeCompare(a.connectedAt));
  const principal =
    ordenadas.find((c) => c.status === 'CONNECTED') ?? ordenadas.find((c) => c.status === 'DISCONNECTING') ?? ordenadas[0] ?? null;
  const anteriores = ordenadas.filter((c) => c !== principal);

  const podeConectar = enabled && podeGerir && (principal === null || principal.status !== 'DISCONNECTING');
  const conectando = principal?.status === 'CONNECTED';

  return (
    <div className="stack">
      <PageHeader
        title="Recebimentos"
        description="A conta do Mercado Pago que recebe os pagamentos dos participantes dos seus sorteios."
        badge={principal ? <ToneBadge tone={describeAccount(principal).tone}>{describeAccount(principal).label}</ToneBadge> : undefined}
      />

      {/* Uma unica regiao viva: os avisos assincronos entram e saem aqui. */}
      <div aria-live="polite" className="stack stack--sm">
        {retorno.kind === 'ok' && (
          <Notice tone="success" title="Conexão concluída">
            <p>A conta do Mercado Pago foi autorizada. Confira o estado abaixo.</p>
          </Notice>
        )}
        {retorno.kind === 'error' && (
          <Notice tone="danger" title="A conexão não foi concluída" live="assertive">
            <p>{retorno.message}</p>
          </Notice>
        )}
        {resultado && (
          <Notice tone="info" title="Pronto">
            <p>{resultado}</p>
          </Notice>
        )}
        {erro && (
          <Notice tone="danger" title="Não foi possível concluir" live="assertive">
            <p>{erro}</p>
          </Notice>
        )}
      </div>

      {!enabled && (
        <Notice tone="neutral" title="Conexão ainda não habilitada">
          <p>O recebimento pelo Mercado Pago ainda não está habilitado neste ambiente. Assim que estiver, o botão de conexão aparece aqui.</p>
        </Notice>
      )}

      {principal === null ? (
        <EmptyState
          icon={<Landmark size={26} aria-hidden="true" />}
          title="Nenhuma conta conectada"
          text="Esta é a conta que receberá os pagamentos dos participantes. Sem ela, os participantes não conseguem pagar. Você será levado ao Mercado Pago para autorizar; não pedimos nenhuma senha ou chave."
          action={
            podeConectar ? (
              <button type="button" className="btn btn--primary" disabled={ocupado} onClick={() => void conectar()}>
                {ocupado ? <span className="btn__spinner" aria-hidden="true" /> : null}
                Conectar Mercado Pago
              </button>
            ) : !podeGerir ? (
              <p className="muted">Somente o proprietário conecta a conta de recebimento.</p>
            ) : undefined
          }
        />
      ) : (
        <>
          <AccountCard conta={principal} destaque />

          {confirmacao?.tipo === 'desconectar' && (
            <ConfirmPanel
              title="Desconectar esta conta?"
              confirmLabel="Desconectar"
              busy={ocupado}
              onConfirm={() => void desconectar(confirmacao.conta)}
              onCancel={() => setConfirmacao(null)}
              returnFocusRef={desconectarRef}
            >
              <ul className="plain-list">
                <li>Novos pagamentos deixarão de usar esta conta imediatamente.</li>
                <li>Pagamentos existentes continuarão sendo tratados quando tecnicamente possível.</li>
                <li>A desconexão pode ficar pendente enquanto houver obrigações financeiras abertas.</li>
              </ul>
            </ConfirmPanel>
          )}

          {confirmacao?.tipo === 'trocar' && (
            <ConfirmPanel
              title="Conectar outra conta de recebimento?"
              confirmLabel="Continuar no Mercado Pago"
              busy={ocupado}
              danger={false}
              onConfirm={() => void conectar()}
              onCancel={() => setConfirmacao(null)}
              returnFocusRef={trocarRef}
            >
              <p>{SWAP_NOTICE}</p>
              <p>Esta conta será desconectada assim que a nova for autorizada, depois de concluir as operações em andamento.</p>
            </ConfirmPanel>
          )}

          {podeGerir && confirmacao === null && (
            <div className="row row--wrap">
              {principal.status === 'CONNECTED' && (
                <>
                  <button ref={trocarRef} type="button" className="btn btn--secondary" disabled={ocupado || !enabled} onClick={() => setConfirmacao({ tipo: 'trocar', conta: principal })}>
                    Conectar outra conta
                  </button>
                  <button ref={desconectarRef} type="button" className="btn btn--danger-ghost" disabled={ocupado} onClick={() => setConfirmacao({ tipo: 'desconectar', conta: principal })}>
                    Desconectar
                  </button>
                </>
              )}
              {principal.status !== 'CONNECTED' && podeConectar && (
                <button type="button" className="btn btn--primary" disabled={ocupado} onClick={() => void conectar()}>
                  {ocupado ? <span className="btn__spinner" aria-hidden="true" /> : null}
                  {principal.status === 'DISCONNECTED' ? 'Conectar Mercado Pago' : 'Conectar novamente'}
                </button>
              )}
              {principal.status === 'DISCONNECTING' && (
                <p className="muted">Aguarde a conclusão da desconexão para conectar uma conta.</p>
              )}
            </div>
          )}

          {conectando && <p className="muted">{SWAP_NOTICE}</p>}

          {anteriores.length > 0 && (
            <section className="section" aria-labelledby="contas-anteriores">
              <div className="section__head">
                <h2 className="section__title" id="contas-anteriores">
                  Contas anteriores
                </h2>
              </div>
              <div className="stack">
                {anteriores.map((c) => (
                  <AccountCard key={c.id} conta={c} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function AccountCard({ conta, destaque = false }: { conta: PaymentAccount; destaque?: boolean }) {
  const visao = describeAccount(conta);
  return (
    <article className="card" aria-label={`Conta Mercado Pago ${maskAccountId(conta.providerAccountId)}`}>
      <div className="card__body stack stack--sm">
        <div className="row row--between row--wrap">
          <h2 className={destaque ? 'section__title' : 'table__primary'}>Mercado Pago</h2>
          <ToneBadge tone={visao.tone}>{visao.label}</ToneBadge>
        </div>
        <p>{visao.message}</p>
        <dl className="stack stack--sm">
          <div className="row row--between">
            <dt className="muted">Conta</dt>
            <dd>{maskAccountId(conta.providerAccountId)}</dd>
          </div>
          <div className="row row--between">
            <dt className="muted">Ambiente</dt>
            <dd>{environmentLabel(conta.environment)}</dd>
          </div>
          <div className="row row--between">
            <dt className="muted">Conectada em</dt>
            <dd>{formatDateTime(conta.connectedAt)}</dd>
          </div>
          {conta.lastVerifiedAt && (
            <div className="row row--between">
              <dt className="muted">Última verificação</dt>
              <dd>{formatDateTime(conta.lastVerifiedAt)}</dd>
            </div>
          )}
          {conta.status === 'DISCONNECTING' && conta.openObligations > 0 && (
            <div className="row row--between">
              <dt className="muted">Operações em andamento</dt>
              <dd>{conta.openObligations}</dd>
            </div>
          )}
        </dl>
      </div>
    </article>
  );
}
