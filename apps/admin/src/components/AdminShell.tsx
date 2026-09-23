import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LogOut, Menu, Shield, X } from 'lucide-react';
import { PLATFORM_ROLE_LABELS, initialsOf, type PlatformPermission } from '@campaigns/shared';
import { useSession } from '../state/SessionProvider.tsx';

/**
 * Casco do console da plataforma.
 *
 * Mesma estrutura do painel do organizador, com a identidade trocada: o
 * simbolo e um escudo e nao um bilhete, e o rodape mostra os SUB-PERFIS de
 * plataforma em vez do papel na comunidade. Sao dois produtos vizinhos; quem
 * opera os dois precisa saber num relance em qual esta.
 *
 * A navegacao continua sendo montada a partir das permissoes de plataforma
 * devolvidas pela API (DOC-01 secao 17): nenhum sub-perfil recebe tudo, e
 * esconder um item nao substitui a checagem do servidor.
 */

export interface AdminNavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly permission: PlatformPermission;
}

export function AdminShell({
  items,
  children,
}: {
  items: readonly AdminNavItem[];
  children: ReactNode;
}) {
  const { session, logout, can } = useSession();
  const [aberta, setAberta] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const location = useLocation();

  useEffect(() => {
    setAberta(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!aberta) return;

    sidebarRef.current?.querySelector<HTMLElement>('a[href], button:not(:disabled)')?.focus();
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setAberta(false);
      requestAnimationFrame(() => menuButtonRef.current?.focus());
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberta]);

  const visiveis = items.filter((item) => can(item.permission));

  return (
    <div className="dash">
      {aberta && <div className="overlay" onClick={() => setAberta(false)} aria-hidden="true" />}

      <aside ref={sidebarRef} className={`dash__sidebar${aberta ? ' is-open' : ''}`}>
        <div className="sidebar__brand">
          <span className="sidebar__logo sidebar__logo--admin" aria-hidden="true">
            <Shield size={18} />
          </span>
          <div>
            <p className="sidebar__wordmark">RIFAS</p>
            <p className="sidebar__product">Console da plataforma</p>
          </div>
        </div>

        {session && session.platformRoles.length > 0 && (
          <div className="sidebar__tenant">
            <div className="sidebar__tenant-info">
              <p className="sidebar__section" style={{ padding: 0, marginBottom: 6 }}>
                Seu acesso
              </p>
              <div className="row row--wrap" style={{ gap: 6 }}>
                {session.platformRoles.map((role) => (
                  <span className="tag tag--adm" key={role}>
                    {PLATFORM_ROLE_LABELS[role]}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <nav className="sidebar__nav" aria-label="Áreas do console">
          {visiveis.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) => `sidebar__link${isActive ? ' is-active' : ''}`}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <span className="sidebar__avatar" aria-hidden="true">
              {initialsOf(session?.user.displayName)}
            </span>
            <div className="sidebar__user-info">
              <p className="sidebar__user-name">{session?.user.displayName}</p>
              <p className="sidebar__user-role">Super Admin</p>
            </div>
            <button
              type="button"
              className="sidebar__signout"
              aria-label="Sair da conta"
              onClick={() => void logout()}
            >
              <LogOut size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      <div className="dash__main">
        <header className="dash__topbar">
          <button
            ref={menuButtonRef}
            type="button"
            className="btn btn--ghost btn--icon dash__menu-btn"
            aria-label={aberta ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={aberta}
            onClick={() => setAberta((valor) => !valor)}
          >
            {aberta ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
          <span className="dash__context">Administração da plataforma</span>
        </header>

        <main className="dash__content" id="conteudo">
          {children}
        </main>
      </div>
    </div>
  );
}
