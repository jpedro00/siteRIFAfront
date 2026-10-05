import {
  ApiClientError,
  formatDate,
  formatInteger,
  type BillingState,
  type PaymentAccount,
} from '@clubedarifa/shared';

/**
 * Textos da area de assinatura e de recebimentos.
 *
 * Duas regras:
 *  - quem le e o ORGANIZADOR, nao um engenheiro: nenhuma palavra da Stripe (`past_due`,
 *    `incomplete`, `unpaid`) nem do provedor chega na tela. O estado de negocio
 *    (`BillingState`) e que decide o texto;
 *  - a tela so INFORMA. Quem permite ou barra uma operacao e a API; estes textos nunca sao
 *    usados para decidir nada.
 */

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export interface StateView {
  readonly label: string;
  readonly tone: Tone;
  readonly headline: string;
  readonly message: string;
}

interface StateContext {
  readonly graceEndsAt: string | null;
  readonly periodEnd: string | null;
  readonly enforcementEnabled: boolean;
}

const ate = (iso: string | null) => formatDate(iso);

/** O que dizer de cada estado de cobranca. */
export function describeBillingState(state: BillingState, ctx: StateContext): StateView {
  switch (state) {
    case 'NO_SUBSCRIPTION':
      return {
        label: 'Sem plano',
        tone: 'neutral',
        headline: 'Sua comunidade ainda não tem um plano',
        message: ctx.enforcementEnabled
          ? 'Escolha um plano para enviar sorteios para revisão. Criar rascunhos continua livre.'
          : 'Escolha um plano abaixo quando quiser. No momento, os limites são apenas informativos e nada é bloqueado.',
      };
    case 'PENDING':
      return {
        label: 'Aguardando pagamento',
        tone: 'info',
        headline: 'Estamos aguardando a confirmação do pagamento',
        message:
          'Recebemos o seu pedido de assinatura. O plano só é liberado quando o pagamento for confirmado; voltar da página de pagamento não ativa o plano por si só.',
      };
    case 'TRIALING':
      return {
        label: 'Período de teste',
        tone: 'success',
        headline: 'Você está no período de teste',
        message: ctx.periodEnd
          ? `O teste vai até ${ate(ctx.periodEnd)}. Depois dele, a cobrança do plano começa.`
          : 'Aproveite os recursos do plano. A cobrança começa quando o teste terminar.',
      };
    case 'ACTIVE':
      return {
        label: 'Ativa',
        tone: 'success',
        headline: 'Sua assinatura está em dia',
        message: 'Tudo certo com o seu plano.',
      };
    case 'PAST_DUE_GRACE':
      return {
        label: 'Pagamento em atraso',
        tone: 'warning',
        headline: 'O último pagamento não foi concluído',
        message: ctx.graceEndsAt
          ? `Você está em período de tolerância até ${ate(ctx.graceEndsAt)}. Atualize a forma de pagamento até lá para não perder o envio de novos sorteios.`
          : 'Você está em período de tolerância. Atualize a forma de pagamento para não perder o envio de novos sorteios.',
      };
    case 'PAST_DUE_BLOCKED':
      return {
        label: 'Pagamento em atraso',
        tone: 'danger',
        headline: 'A tolerância terminou e o pagamento segue pendente',
        message:
          'Enquanto o pagamento não for regularizado, não é possível enviar novos sorteios para revisão. Sorteios já publicados e os pagamentos dos participantes não são afetados.',
      };
    case 'UNPAID':
      return {
        label: 'Sem pagamento',
        tone: 'danger',
        headline: 'A assinatura está sem pagamento',
        message:
          'As tentativas de cobrança não deram certo. Atualize a forma de pagamento para voltar a enviar novos sorteios.',
      };
    case 'PAUSED':
      return {
        label: 'Pausada',
        tone: 'warning',
        headline: 'A assinatura está pausada',
        message: 'Retome a assinatura para voltar a enviar novos sorteios para revisão.',
      };
    case 'CANCELED':
      return {
        label: 'Cancelada',
        tone: 'neutral',
        headline: 'A assinatura foi cancelada',
        message: 'Você pode contratar um plano novamente a qualquer momento. Seus sorteios e vendas continuam preservados.',
      };
  }
}

/** Estados em que a pessoa ainda pode escolher um plano novo. */
export const STATES_THAT_CAN_SUBSCRIBE: readonly BillingState[] = ['NO_SUBSCRIPTION', 'CANCELED'];

/** "4 de 5" ou, sem teto, "4 em uso · sem limite". Nunca inventa um numero para o ilimitado. */
export function describeUsage(used: number, max: number | null): string {
  return max === null ? `${formatInteger(used)} em uso · sem limite` : `${formatInteger(used)} de ${formatInteger(max)}`;
}

export function intervalLabel(interval: 'month' | 'year'): string {
  return interval === 'month' ? 'mês' : 'ano';
}

// ---------------------------------------------------------------------------
// Erros de limite e de assinatura (a API decide; a tela explica)
// ---------------------------------------------------------------------------

export interface EntitlementMessage {
  readonly message: string;
  /** Oferecer o caminho para a area de assinatura. */
  readonly offerSubscription: boolean;
}

/**
 * O erro de limite ou de assinatura. A API ja devolve a frase em portugues, escrita para a
 * pessoa (sem termo da Stripe); a tela a usa e acrescenta o caminho para a area de
 * assinatura. Quem decide a tela e o CODIGO, nunca o texto.
 */
export function describeEntitlementError(error: unknown, fallback: string): EntitlementMessage {
  if (!(error instanceof ApiClientError)) return { message: fallback, offerSubscription: false };
  const oferece =
    error.code === 'PLAN_LIMIT_REACHED' || error.code === 'SUBSCRIPTION_REQUIRED' || error.code === 'FEATURE_NOT_IN_PLAN';
  return { message: error.message || fallback, offerSubscription: oferece };
}

// ---------------------------------------------------------------------------
// Recebimentos
// ---------------------------------------------------------------------------

/** Motivos que o retorno do OAuth pode trazer na URL. Qualquer outro cai no texto generico. */
const OAUTH_REASONS: Readonly<Record<string, string>> = {
  missing_state: 'A conexão não pôde ser confirmada. Inicie novamente.',
  invalid_state: 'Este pedido de conexão expirou ou já foi usado. Inicie a conexão novamente.',
  wrong_user: 'A conexão foi iniciada por outra pessoa. Inicie novamente com a sua conta.',
  not_authorized: 'Seu perfil não tem permissão para conectar a conta de recebimento desta comunidade.',
  provider_denied: 'A autorização foi cancelada no Mercado Pago. Nenhuma conta foi conectada.',
  missing_code: 'O Mercado Pago não confirmou a autorização. Tente novamente.',
  exchange_failed: 'Não foi possível concluir a autorização com o Mercado Pago. Tente novamente.',
  provider_unavailable: 'O Mercado Pago está indisponível no momento. Tente novamente em alguns minutos.',
  identity_mismatch: 'Não foi possível confirmar a identidade da conta do Mercado Pago. Tente novamente.',
  environment_mismatch: 'A conta autorizada é de outro ambiente (teste ou produção). Use uma conta compatível.',
};

export const OAUTH_UNKNOWN_REASON = 'Não foi possível concluir a conexão. Tente novamente.';

export type OAuthReturn =
  | { readonly kind: 'none' }
  | { readonly kind: 'ok' }
  | { readonly kind: 'error'; readonly message: string };

/**
 * Le o retorno do OAuth (`?conexao=ok` ou `?conexao=erro&motivo=...`). O motivo so vira texto
 * se estiver na lista controlada — nunca se imprime o que veio da URL.
 */
export function readOAuthReturn(params: URLSearchParams): OAuthReturn {
  const conexao = params.get('conexao');
  if (conexao === 'ok') return { kind: 'ok' };
  if (conexao === 'erro') {
    const motivo = params.get('motivo') ?? '';
    return { kind: 'error', message: Object.hasOwn(OAUTH_REASONS, motivo) ? OAUTH_REASONS[motivo]! : OAUTH_UNKNOWN_REASON };
  }
  return { kind: 'none' };
}

export interface AccountView {
  readonly label: string;
  readonly tone: Tone;
  readonly message: string;
}

/** O que dizer de cada estado da conta de recebimento. */
export function describeAccount(account: PaymentAccount): AccountView {
  switch (account.status) {
    case 'CONNECTED':
      return account.canReceivePayments
        ? { label: 'Conectada', tone: 'success', message: 'Novos pagamentos dos participantes entram nesta conta.' }
        : {
            label: 'Conectada, com atenção',
            tone: 'warning',
            message: 'A conta está conectada, mas não está aceitando novos pagamentos agora. Reconecte se o problema continuar.',
          };
    case 'DISCONNECTING':
      return {
        label: 'Desconectando',
        tone: 'warning',
        message:
          'A conexão não aceita novos pagamentos, mas ainda está sendo mantida para concluir operações existentes.',
      };
    case 'DISCONNECTED':
      return { label: 'Desconectada', tone: 'neutral', message: 'Esta conta não recebe mais pagamentos.' };
    case 'REVOKED':
      return {
        label: 'Acesso revogado',
        tone: 'danger',
        message:
          'O acesso a esta conta foi revogado no Mercado Pago. Conecte novamente para voltar a receber. Pagamentos em andamento podem precisar de atenção manual.',
      };
    case 'ERROR':
      return {
        label: 'Precisa de atenção',
        tone: 'danger',
        message:
          'Houve um problema com esta conexão. Conecte novamente para voltar a receber. Não é possível garantir a consulta dos pagamentos em andamento.',
      };
  }
}

/** "Sandbox" nao e palavra do organizador. */
export function environmentLabel(environment: PaymentAccount['environment']): string {
  return environment === 'PRODUCTION' ? 'Produção' : 'Testes';
}

/** Mostra so o final do identificador: ele nao e segredo, mas tambem nao precisa aparecer inteiro. */
export function maskAccountId(id: string): string {
  return id.length <= 4 ? id : `•••• ${id.slice(-4)}`;
}

export const SWAP_NOTICE =
  'Alterar a conta de recebimento afeta apenas novos pagamentos. Transações anteriores permanecem vinculadas à conta utilizada originalmente.';
