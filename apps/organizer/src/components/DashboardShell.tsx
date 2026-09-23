import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { LogOut, Menu, Ticket, X } from 'lucide-react';
import { MEMBERSHIP_ROLE_LABELS, initialsOf, type TenantPermission } from '@campaigns/shared';
import { useSession } from '../state/SessionProvider.tsx';

/**
 * Casco do painel: barra lateral + barra superior + conteudo.
 *
 * POR QUE NAO PARECE A VITRINE
 * ----------------------------
 * Sao dois produtos com trabalhos diferentes. A vitrine convence em segundos
 * e vive no telefone; o painel e uma ferramenta de operacao, usada por
 * sessoes longas, quase sempre num monitor. Por isso: navegacao permanente a
 * esquerda em superficie escura, densidade maior e nenhuma area de venda.
 *
 * O QUE SAIU
 * ----------
 * A lista de areas "previstas para as proximas fases". Ela era honesta, mas o
 * efeito no painel era o oposto do pretendido: metade do menu desabilitado
 * anuncia um produto incompleto a quem esta pagando para usa-lo. O menu agora
 * mostra o que existe; o que falta esta no documento de roadmap, que e onde
 * roadmap pertence.
 *
 * PERMISSAO
 * ---------
 * `can()` decide o que aparece, mas esconder um item NAO e controle de
 * acesso: cada rota exige a permissao no servidor. O menu evita caminho sem
 * saida — nao e a tranca.
 */

export interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly permission: TenantPermission;
  readonly exact?: boolean;
  readonly section?: string;
}

export function DashboardShell({
  items,
  children,
  topbar,
}: {
  items: readonly NavItem[];
  children: ReactNode;
  topbar?: ReactNode;
}) {
  const { session, tenant, logout, can } = useSession();
  const [aberta, setAberta] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const location = useLocation();

  // Navegar fecha a gaveta. Sem isso, no tablet, a pagina troca por tras de
  // um painel que continua cobrindo a tela.
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

  // Agrupa preservando a ordem em que as secoes aparecem na lista.
  const secoes = visiveis.reduce<{ nome: string | undefined; itens: NavItem[] }[]>((acc, item) => {
    const ultima = acc[acc.length - 1];
    if (ultima && ultima.nome === item.section) {
      ultima.itens.push(item);
    } else {
      acc.push({ nome: item.section, itens: [item] });
    }
    return acc;
  }, []);

  const papel = tenant?.roles?.[0];

  return (
    <div className="dash">
      {aberta && (
        <div className="overlay" onClick={() => setAberta(false)} aria-hidden="true" />
      )}

      <aside ref={sidebarRef} className={`dash__sidebar${aberta ? ' is-open' : ''}`}>
        <div className="sidebar__brand">
          <span className="sidebar__logo" aria-hidden="true">
            <Ticket size={18} />
          </span>
          <div>
            <p className="sidebar__wordmark">RIFAS</p>
            <p className="sidebar__product">Painel do organizador</p>
          </div>
        </div>

        {tenant && (
          <div className="sidebar__tenant">
            <span className="sidebar__tenant-avatar" aria-hidden="true">
              {initialsOf(tenant.name)}
            </span>
            <div className="sidebar__tenant-info">
              <p className="sidebar__tenant-name">{tenant.name}</p>
              <p className="sidebar__tenant-slug">{tenant.slug}</p>
            </div>
          </div>
        )}

        <nav className="sidebar__nav" aria-label="Áreas do painel">
          {secoes.map((secao, indice) => (
            <div key={secao.nome ?? `secao-${indice}`}>
              {secao.nome && <p className="sidebar__section">{secao.nome}</p>}
              {secao.itens.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact ?? false}
                  className={({ isActive }) =>
                    `sidebar__link${isActive ? ' is-active' : ''}`
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <span className="sidebar__avatar" aria-hidden="true">
              {initialsOf(session?.user.displayName)}
            </span>
            <div className="sidebar__user-info">
              <p className="sidebar__user-name">{session?.user.displayName}</p>
              {papel && <p className="sidebar__user-role">{MEMBERSHIP_ROLE_LABELS[papel]}</p>}
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
          {topbar}
        </header>

        <main className="dash__content" id="conteudo">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Migalhas da barra superior. O ultimo item e o lugar atual, sem link. */
export function Breadcrumbs({
  trail,
}: {
  trail: readonly { label: string; to?: string }[];
}) {
  return (
    <nav className="breadcrumbs" aria-label="Você está em">
      {trail.map((item, indice) => {
        const ultimo = indice === trail.length - 1;
        return (
          <span key={`${item.label}-${indice}`} className="row" style={{ gap: 8 }}>
            {indice > 0 && (
              <span className="breadcrumbs__sep" aria-hidden="true">
                /
              </span>
            )}
            {ultimo || !item.to ? (
              <span className="breadcrumbs__current" aria-current="page">
                {item.label}
              </span>
            ) : (
              <Link to={item.to}>{item.label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
