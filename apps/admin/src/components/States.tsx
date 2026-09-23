import type { ReactNode } from 'react';
import { ApiClientError } from '@campaigns/shared';

/**
 * Estados de tela compartilhados: carregando, erro e acesso negado.
 *
 * A tela decide pelo CODIGO do erro devolvido pelo contrato, nunca pelo texto
 * da mensagem — texto muda, codigo nao.
 *
 * Nenhum destes componentes inventa dado. Quando nao ha resposta da API, a
 * tela diz que nao ha; nao mostra numero de exemplo.
 */

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="state state--loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function AccessDenied({
  title = 'Acesso negado',
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="state state--denied" role="alert">
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </div>
  );
}

export function NotFoundState({
  title = 'Página não encontrada',
  message = 'Este endereço não existe neste painel.',
  action,
}: {
  title?: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state state--denied" role="status">
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  if (error instanceof ApiClientError) {
    // Falta de permissao e falta de comunidade tem tela propria; nao sao
    // apresentadas como falha do sistema.
    if (error.code === 'FORBIDDEN') {
      return (
        <AccessDenied message="Seu perfil não tem permissão para ver esta área desta comunidade." />
      );
    }
    if (error.code === 'TENANT_ACCESS_DENIED' || error.code === 'TENANT_NOT_RESOLVED') {
      return (
        <AccessDenied
          title="Comunidade não encontrada"
          message="Esta comunidade não existe ou você não tem vínculo com ela."
        />
      );
    }
    if (error.code === 'MFA_REQUIRED' || error.code === 'MFA_ENROLLMENT_REQUIRED') {
      return (
        <AccessDenied
          title="Verificação em duas etapas"
          message={error.message}
        />
      );
    }

    return (
      <div className="state state--error" role="alert">
        <h2>Não foi possível carregar</h2>
        <p>{error.message}</p>
        <p className="state__code">Código: {error.code}</p>
        {onRetry && (
          <button type="button" onClick={onRetry}>
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="state state--error" role="alert">
      <h2>Não foi possível carregar</h2>
      <p>Ocorreu um erro inesperado. Tente novamente em instantes.</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}
