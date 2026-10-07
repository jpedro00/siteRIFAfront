import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  classifySessionFailure,
  sessionNeed,
  type LoginResponse,
  type MembershipSummary,
  type SessionResponse,
  type TenantContextResponse,
  type TenantPermission,
} from '@clubedarifa/shared';
import { api, storeSelectedCommunity } from '../api.ts';

/**
 * Estado de sessao do painel.
 *
 * O token NUNCA passa por aqui: ele vive num cookie httpOnly que o JavaScript
 * da pagina nao le. Este provider guarda apenas o que a API respondeu sobre a
 * sessao.
 *
 * O controle de acesso real esta no backend. O que este provider faz e evitar
 * mostrar telas que a pessoa nao pode usar — o que NAO substitui a checagem do
 * servidor, apenas evita um caminho sem saida.
 */

export type SessionStatus =
  | 'loading'
  | 'anonymous'
  | 'mfa_required'
  | 'mfa_enrollment_required'
  /**
   * Nao foi possivel FALAR com a API. Estado proprio, separado de
   * 'anonymous': erro de rede nao e prova de que a sessao acabou.
   */
  | 'unavailable'
  | 'authenticated';

interface SessionState {
  readonly status: SessionStatus;
  readonly session: SessionResponse | null;
  readonly tenant: TenantContextResponse | null;
  readonly tenantError: unknown;
  readonly tenantLoading: boolean;
  login(email: string, password: string): Promise<LoginResponse['status']>;
  verifyMfa(code: string): Promise<void>;
  enrollMfa(): Promise<{ secret: string; otpauthUri: string }>;
  confirmMfa(code: string): Promise<void>;
  logout(): Promise<void>;
  can(permission: TenantPermission): boolean;
  reloadTenant(): void;
  /** Comunidades em que a conta tem vinculo (vem da SESSAO, nao do cliente). */
  readonly communities: readonly MembershipSummary[];
  /** Conta com varios vinculos e nenhuma escolha valida: o painel pede para escolher. */
  readonly needsCommunity: boolean;
  /** Conta autenticada sem vinculo nenhum: ainda nao e criadora de nenhuma comunidade. */
  readonly noCommunity: boolean;
  selectCommunity(slug: string): void;
}

const SessionContext = createContext<SessionState | null>(null);

/**
 * RN12 na tela. A regra mora em `@clubedarifa/shared` e tem teste proprio — os
 * tres frontends faziam esta mesma conta, cada um do seu jeito.
 */
function statusFromSession(session: SessionResponse): SessionStatus {
  switch (sessionNeed(session)) {
    case 'mfa_code':
      return 'mfa_required';
    case 'mfa_enrollment':
      return 'mfa_enrollment_required';
    default:
      return 'authenticated';
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [tenant, setTenant] = useState<TenantContextResponse | null>(null);
  const [tenantError, setTenantError] = useState<unknown>(null);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantReloadToken, setTenantReloadToken] = useState(0);
  const [chosenSlug, setChosenSlug] = useState<string | null>(() => api.tenantSlug);

  const communities = useMemo(() => session?.memberships ?? [], [session]);
  // A escolha so vale se for um vinculo REAL da sessao; com um unico vinculo, e ele.
  const effectiveSlug = useMemo(() => {
    if (chosenSlug && communities.some((m) => m.tenantSlug === chosenSlug)) return chosenSlug;
    if (communities.length === 1) return communities[0]!.tenantSlug;
    return null;
  }, [chosenSlug, communities]);
  const needsCommunity = status === 'authenticated' && communities.length > 1 && effectiveSlug === null;
  const noCommunity = status === 'authenticated' && communities.length === 0;

  const loadSession = useCallback(async () => {
    try {
      const result = await api.call('session');
      setSession(result);
      setStatus(statusFromSession(result));
    } catch (error) {
      // Erro de rede NAO pode fingir que a pessoa saiu. Mandar quem sofreu uma
      // queda de tres segundos para a tela de login faz a pessoa reentrar
      // achando que a sessao expirou — e perde o que estava na tela.
      if (classifySessionFailure(error) === 'unauthenticated') {
        setSession(null);
        setStatus('anonymous');
        return;
      }
      setStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  // O contexto da comunidade so e buscado com a sessao completa. Buscar antes
  // produziria um 403 de MFA que a tela leria como "sem permissao".
  useEffect(() => {
    if (status !== 'authenticated') {
      setTenant(null);
      setTenantError(null);
      return;
    }
    // Sem comunidade valida (nenhuma, ou varias sem escolha): nada a carregar ainda.
    if (effectiveSlug === null) {
      setTenant(null);
      setTenantError(null);
      return;
    }
    api.setTenantSlug(effectiveSlug);

    let cancelled = false;
    setTenantLoading(true);
    setTenantError(null);

    api
      .call('tenantContext')
      .then((result) => {
        if (!cancelled) setTenant(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setTenant(null);
          setTenantError(error);
        }
      })
      .finally(() => {
        if (!cancelled) setTenantLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status, tenantReloadToken, effectiveSlug]);

  const value = useMemo<SessionState>(
    () => ({
      status,
      session,
      tenant,
      tenantError,
      tenantLoading,

      async login(email, password) {
        const result = await api.call('login', { email, password });
        await loadSession();
        return result.status;
      },

      async verifyMfa(code) {
        await api.call('mfaVerify', { code });
        await loadSession();
      },

      async enrollMfa() {
        return api.call('mfaEnrollStart');
      },

      async confirmMfa(code) {
        await api.call('mfaEnrollConfirm', { code });
        await loadSession();
      },

      async logout() {
        try {
          await api.call('logout');
        } finally {
          setSession(null);
          setTenant(null);
          setStatus('anonymous');
        }
      },

      can(permission) {
        return tenant?.permissions.includes(permission) ?? false;
      },

      reloadTenant() {
        setTenantReloadToken((token) => token + 1);
      },

      communities,
      needsCommunity,
      noCommunity,
      selectCommunity(slug) {
        storeSelectedCommunity(slug);
        api.setTenantSlug(slug);
        setTenant(null);
        setChosenSlug(slug);
      },
    }),
    [status, session, tenant, tenantError, tenantLoading, loadSession, communities, needsCommunity, noCommunity],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession precisa estar dentro de <SessionProvider>.');
  }
  return context;
}
