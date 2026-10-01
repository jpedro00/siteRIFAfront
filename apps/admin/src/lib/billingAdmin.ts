import type { BillingState, PlanStatus, PlatformPlan, SubscriptionStatus } from '@clubedarifa/shared';

/**
 * Textos do console para planos e assinaturas. O Super Admin le informacao mais operacional
 * que o organizador: aqui aparece o estado de negocio E o estado bruto da Stripe.
 */

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export const PLAN_STATUS_VIEW: Record<PlanStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Rascunho', tone: 'neutral' },
  AVAILABLE: { label: 'À venda', tone: 'success' },
  ARCHIVED: { label: 'Arquivado', tone: 'warning' },
};

export const BILLING_STATE_VIEW: Record<BillingState, { label: string; tone: Tone }> = {
  NO_SUBSCRIPTION: { label: 'Sem assinatura', tone: 'neutral' },
  PENDING: { label: 'Aguardando pagamento', tone: 'info' },
  TRIALING: { label: 'Em teste', tone: 'info' },
  ACTIVE: { label: 'Ativa', tone: 'success' },
  PAST_DUE_GRACE: { label: 'Em atraso (tolerância)', tone: 'warning' },
  PAST_DUE_BLOCKED: { label: 'Em atraso (bloqueada)', tone: 'danger' },
  UNPAID: { label: 'Sem pagamento', tone: 'danger' },
  PAUSED: { label: 'Pausada', tone: 'warning' },
  CANCELED: { label: 'Cancelada', tone: 'neutral' },
};

/** Estados que tem linha na consulta (quem nunca assinou nao tem assinatura para listar). */
export const FILTERABLE_STATES: readonly BillingState[] = [
  'ACTIVE',
  'TRIALING',
  'PENDING',
  'PAST_DUE_GRACE',
  'PAST_DUE_BLOCKED',
  'UNPAID',
  'PAUSED',
  'CANCELED',
];

export const STRIPE_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  incomplete: 'incomplete',
  incomplete_expired: 'incomplete_expired',
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  canceled: 'canceled',
  unpaid: 'unpaid',
  paused: 'paused',
};

export function intervalLabel(interval: 'month' | 'year'): string {
  return interval === 'month' ? 'mês' : 'ano';
}

/** "R$ 49,90" a partir de centavos; o console nao usa a moeda so para o BRL. */
export function formatPlanPrice(plan: Pick<PlatformPlan, 'priceCents' | 'currency' | 'interval'>): string {
  const valor = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: plan.currency.toUpperCase() }).format(plan.priceCents / 100);
  return `${valor} / ${intervalLabel(plan.interval)}`;
}

/** Limite de plano em texto: nulo e ILIMITADO, nunca um numero inventado. */
export function limitLabel(value: number | null): string {
  return value === null ? 'Ilimitado' : String(value);
}

/** "49,90" ou "49.90" -> 4990. Devolve null se nao for um valor util (zero e permitido: plano gratuito). */
export function parsePriceToCents(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  if (limpo === '') return null;
  const valor = Number(limpo);
  if (!Number.isFinite(valor) || valor < 0) return null;
  return Math.round(valor * 100);
}

/** Um plano ainda sem Price na Stripe: foi gravado, mas a sincronizacao nao terminou. */
export function isPendingSync(plan: Pick<PlatformPlan, 'stripePriceId'>): boolean {
  return plan.stripePriceId === null;
}

/** Transicoes de status que o console oferece. O servidor e quem valida. */
export function statusActions(plan: PlatformPlan): { to: PlanStatus; label: string }[] {
  if (isPendingSync(plan)) return [];
  switch (plan.status) {
    case 'DRAFT':
      return [{ to: 'AVAILABLE', label: 'Publicar' }];
    case 'AVAILABLE':
      return [{ to: 'ARCHIVED', label: 'Arquivar' }];
    case 'ARCHIVED':
      return [{ to: 'AVAILABLE', label: 'Reativar' }];
  }
}

/** Nome amigavel dos jobs, para a pagina de Saude (o nome tecnico continua visivel). */
export const JOB_DESCRIPTIONS: Readonly<Record<string, string>> = {
  'processar-stripe-eventos': 'Processa os eventos da Stripe (assinaturas)',
  'limpar-stripe-eventos': 'Retenção dos eventos da Stripe',
  'renovar-credenciais-pagamento': 'Renova as autorizações do Mercado Pago antes de vencerem',
  'finalizar-desconexoes-pagamento': 'Conclui as desconexões de contas de recebimento',
};
