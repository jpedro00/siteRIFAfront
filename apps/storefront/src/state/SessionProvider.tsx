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
  ApiClientError,
  classifySessionFailure,
  sessionNeed,
  type PublicTenantBranding,
  type SessionResponse,
} from '@clubedarifa/shared';
import { api } from '../api.ts';
import { IS_CENTRAL } from '../lib/mode.ts';

/**
 * Estado da vitrine.
 *
 * Duas coisas independentes convivem aqui:
 *
 *   COMUNIDADE · resolvida pelo servidor a partir do dominio. A vitrine e
 *                publica: a marca carrega SEM sessao. Dominio desconhecido
 *                nao cai numa comunidade padrao — vira "nao encontrada".
 *
 *   SESSAO     · opcional, e de proposito. Comprar um numero NAO exige conta:
 *                os dados do comprador sao pedidos no checkout e o pedido fica
 *                ligado ao comprovante, nao a um usuario. Entrar serve para a
 *                area de conta; a compra funciona sem isso.
 */
/** Login aceito pela API, mas o navegador nao guardou o cookie de sessao. */
export class SessionCookieBlockedError extends Error {
  constructor() {
    super(
      'Sua senha está correta, mas o navegador bloqueou o cookie de sessão e não foi possível entrar. Libere os cookies para este site (ou desative o bloqueio de cookies de terceiros) e tente de novo.',
    );
    this.name = 'SessionCookieBlockedError';
  }
}

export type TenantStatus = 'loading' | 'resolved' | 'not_found' | 'error';
export type SessionStatus =
  | 'loading'
  | 'anonymous'
  | 'mfa_required'
  /** Perfil que exige MFA (dono, financeiro, Super Admin) e ainda sem fator: cadastrar, nao verificar. */
  | 'mfa_enrollment_required'
  /** Nao foi possivel FALAR com a API — nao e prova de que a sessao acabou. */
  | 'unavailable'
  | 'authenticated';

interface StorefrontState {
  readonly tenantStatus: TenantStatus;
  readonly tenant: PublicTenantBranding | null;
  readonly tenantError: unknown;
  readonly sessionStatus: SessionStatus;
  readonly session: SessionResponse | null;
  login(email: string, password: string): Promise<void>;
  verifyMfa(code: string): Promise<void>;
  enrollMfa(): Promise<{ secret: string; otpauthUri: string }>;
  confirmMfa(code: string): Promise<void>;
  logout(): Promise<void>;
  reloadTenant(): void;
  /** Rele a sessao (ex.: depois de a conta virar dona de uma comunidade). */
  refreshSession(): Promise<void>;
}

const StorefrontContext = createContext<StorefrontState | null>(null);

export function StorefrontProvider({ children }: { children: ReactNode }) {
  const [tenantStatus, setTenantStatus] = useState<TenantStatus>('loading');
  const [tenant, setTenant] = useState<PublicTenantBranding | null>(null);
  const [tenantError, setTenantError] = useState<unknown>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('loading');
  const [session, setSession] = useState<SessionResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Marketplace central: nao ha UMA comunidade. A comunidade de cada rifa vem do caminho.
    if (IS_CENTRAL) {
      setTenant(null);
      setTenantStatus('resolved');
      return;
    }
    setTenantStatus('loading');
    setTenantError(null);

    api
      .call('publicTenantBranding')
      .then((result) => {
        if (cancelled) return;
        setTenant(result);
        setTenantStatus('resolved');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setTenant(null);
        setTenantError(error);
        // 404 nao e falha do sistema: e comunidade inexistente.
        const notFound =
          error instanceof ApiClientError && error.code === 'TENANT_NOT_RESOLVED';
        setTenantStatus(notFound ? 'not_found' : 'error');
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const loadSession = useCallback(async (): Promise<SessionStatus> => {
    try {
      const result = await api.call('session');
      setSession(result);
      const need = sessionNeed(result);
      const proximo: SessionStatus =
        need === 'nothing' ? 'authenticated' : need === 'mfa_enrollment' ? 'mfa_enrollment_required' : 'mfa_required';
      setSessionStatus(proximo);
      return proximo;
    } catch (error) {
      // Visitante sem sessao e o caso NORMAL na vitrine, nao um erro — mas
      // "nao consegui perguntar" tambem nao e "visitante". A vitrine e publica
      // e continua navegavel nos dois casos; o que muda e o que ela AFIRMA.
      if (classifySessionFailure(error) === 'unauthenticated') {
        setSession(null);
        setSessionStatus('anonymous');
        return 'anonymous';
      }
      setSessionStatus('unavailable');
      return 'unavailable';
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const value = useMemo<StorefrontState>(
    () => ({
      tenantStatus,
      tenant,
      tenantError,
      sessionStatus,
      session,

      async login(email, password) {
        await api.call('login', { email, password });
        const estado = await loadSession();
        // A API aceitou a senha (200) mas a sessao nao existe logo depois: o navegador DESCARTOU o
        // cookie (bloqueio de cookies de terceiros, modo anonimo, Safari/Firefox/Brave). Sem este
        // aviso a pessoa so veria a tela de login de novo, sem saber por que.
        if (estado === 'anonymous') throw new SessionCookieBlockedError();
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
          setSessionStatus('anonymous');
        }
      },

      reloadTenant() {
        setReloadToken((token) => token + 1);
      },

      async refreshSession() {
        await loadSession();
      },
    }),
    [tenantStatus, tenant, tenantError, sessionStatus, session, loadSession],
  );

  return <StorefrontContext.Provider value={value}>{children}</StorefrontContext.Provider>;
}

export function useStorefront(): StorefrontState {
  const context = useContext(StorefrontContext);
  if (!context) throw new Error('useStorefront precisa estar dentro de <StorefrontProvider>.');
  return context;
}
