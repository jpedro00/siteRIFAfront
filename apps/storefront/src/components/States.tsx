import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw, SearchX } from 'lucide-react';
import { ApiClientError } from '@campaigns/shared';

/**
 * Estados de tela da vitrine.
 *
 * REGRA DE LINGUAGEM — a diferenca entre um produto e um painel de debug:
 * nenhuma mensagem tecnica chega ao participante. Ele nao sabe o que e um
 * tenant, nao deve ler um codigo de erro e nao tem o que fazer com um stack
 * trace. Cada estado responde tres coisas em linguagem comum: o que
 * aconteceu, se ele perdeu alguma coisa, e o que fazer agora.
 *
 *   errado: "TENANT_NOT_RESOLVED: tenant nao resolvido para o host"
 *   certo:  "Não foi possível carregar esta comunidade."
 *
 * A DECISAO continua sendo tomada pelo CODIGO do erro, nunca pelo texto:
 * texto muda de uma versao para a outra, codigo e contrato.
 */

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p className="muted">{label}</p>
    </div>
  );
}

export function NotFoundState({
  title = 'Página não encontrada',
  message = 'O endereço que você acessou não existe ou foi removido.',
  action,
}: {
  title?: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">
        <SearchX size={28} aria-hidden="true" />
      </span>
      <h1 className="empty-state__title">{title}</h1>
      <p className="empty-state__text">{message}</p>
      {action && <div className="empty-state__actions">{action}</div>}
    </div>
  );
}

/**
 * Falha ao carregar.
 *
 * O botao de tentar de novo so aparece quando ha o que tentar. Oferecer
 * "tentar novamente" para um erro que vai se repetir identico e uma armadilha
 * educada.
 */
export function ErrorState({
  error,
  onRetry,
  title,
}: {
  error?: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const mensagem = mensagemPara(error);

  return (
    <div className="empty-state empty-state--danger" role="alert">
      <span className="empty-state__icon">
        <AlertTriangle size={28} aria-hidden="true" />
      </span>
      <h2 className="empty-state__title">{title ?? 'Não foi possível carregar'}</h2>
      <p className="empty-state__text">{mensagem}</p>
      {onRetry && (
        <div className="empty-state__actions">
          <button type="button" className="btn btn--secondary" onClick={onRetry}>
            <RefreshCw size={16} aria-hidden="true" />
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Traducao de codigo de erro para linguagem de quem compra.
 *
 * O caso padrao NAO repassa `error.message` da API: essa mensagem foi escrita
 * para quem opera o sistema e pode conter vocabulario interno. Uma frase
 * generica e honesta ("tente de novo em instantes") serve melhor do que uma
 * precisa e incompreensivel.
 */
export function mensagemPara(error: unknown): string {
  if (error instanceof ApiClientError) {
    switch (error.code) {
      case 'TENANT_NOT_RESOLVED':
      case 'TENANT_ACCESS_DENIED':
        return 'Não foi possível carregar esta comunidade. Confira o endereço que você acessou.';
      case 'NOT_FOUND':
        return 'Não encontramos o que você procura. O conteúdo pode ter sido removido.';
      case 'CONFLICT':
        return 'Alguns números que você escolheu acabaram de ser reservados por outra pessoa. Escolha outros para continuar.';
      case 'UNAUTHENTICATED':
        return 'Sua sessão expirou. Entre novamente para continuar.';
      case 'FORBIDDEN':
        return 'Você não tem acesso a esta área.';
      case 'BAD_REQUEST':
        return 'Confira os dados informados e tente novamente.';
      case 'RATE_LIMITED':
        return 'Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo.';
      default:
        return 'Tivemos um problema ao carregar esta página. Tente novamente em instantes.';
    }
  }
  return 'Tivemos um problema ao carregar esta página. Tente novamente em instantes.';
}
