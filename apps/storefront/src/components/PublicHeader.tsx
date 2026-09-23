import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { LogIn, Menu, Ticket, User, X } from 'lucide-react';
import { initialsOf } from '@campaigns/shared';
import { useStorefront } from '../state/SessionProvider.tsx';

/**
 * Cabecalho publico.
 *
 * O QUE ELE NAO TEM, de proposito:
 * nenhuma mencao a fase, roadmap ou area "em construcao". Quem chega aqui e
 * um participante, nao alguem acompanhando o desenvolvimento — ver "Fase 2"
 * ao lado do premio diz que o site nao esta pronto, e o carrinho e abandonado
 * antes de comecar.
 *
 * "Resultados" so aparece quando ha resultado de verdade. Um link que leva a
 * uma tela vazia custa mais confianca do que um item a menos no menu.
 */
export function PublicHeader({ hasResults = false }: { hasResults?: boolean }) {
  const { tenant, sessionStatus, session } = useStorefront();
  const [compacto, setCompacto] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Encolhe ao rolar: devolve altura de tela no celular sem tirar a
  // navegacao do alcance.
  useEffect(() => {
    const aoRolar = () => setCompacto(window.scrollY > 16);
    aoRolar();
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => window.removeEventListener('scroll', aoRolar);
  }, []);

  // Navegar fecha o menu. Sem isso, tocar num link no celular troca a pagina
  // por baixo de um painel que continua aberto.
  useEffect(() => {
    setMenuAberto(false);
  }, [location.pathname]);

  // Menu aberto trava a rolagem do corpo; caso contrario a pagina rola atras
  // do painel e a pessoa perde o lugar onde estava.
  useEffect(() => {
    if (!menuAberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const primeiroControle = menuRef.current?.querySelector<HTMLElement>('a[href], button:not(:disabled)');
    primeiroControle?.focus();

    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setMenuAberto(false);
      requestAnimationFrame(() => toggleRef.current?.focus());
    };
    document.addEventListener('keydown', aoTeclar);

    return () => {
      document.body.style.overflow = anterior;
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [menuAberto]);

  const autenticado = sessionStatus === 'authenticated' && session;
  const nomeComunidade = tenant?.publicName ?? tenant?.name ?? 'Comunidade';

  const links = [
    { to: '/', rotulo: 'Início', exato: true },
    { to: '/sorteios', rotulo: 'Sorteios', exato: false },
    ...(hasResults ? [{ to: '/resultados', rotulo: 'Resultados', exato: false }] : []),
  ];

  return (
    <header className={`site-header${compacto ? ' is-compact' : ''}`}>
      <div className="container site-header__inner">
        <Link className="site-header__brand" to="/">
          <span className="site-header__mark" aria-hidden="true">
            <Ticket size={18} />
          </span>
          <span className="site-header__name">{nomeComunidade}</span>
        </Link>

        <nav className="site-header__nav" aria-label="Navegação principal">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.exato}
              className={({ isActive }) =>
                `site-header__link${isActive ? ' is-active' : ''}`
              }
            >
              {link.rotulo}
            </NavLink>
          ))}
        </nav>

        <div className="site-header__actions">
          {autenticado ? (
            <Link className="site-header__account" to="/conta">
              <span className="site-header__avatar" aria-hidden="true">
                {initialsOf(session.user.displayName)}
              </span>
              <span className="site-header__account-name">Minha conta</span>
            </Link>
          ) : (
            <Link className="btn btn--secondary btn--sm site-header__signin" to="/conta">
              <LogIn size={15} aria-hidden="true" />
              Entrar
            </Link>
          )}

          <button
            ref={toggleRef}
            type="button"
            className="btn btn--ghost btn--icon site-header__toggle"
            aria-expanded={menuAberto}
            aria-controls="menu-movel"
            aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMenuAberto((aberto) => !aberto)}
          >
            {menuAberto ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {menuAberto && (
        <div className="mobile-menu" id="menu-movel" ref={menuRef}>
          <nav className="mobile-menu__nav" aria-label="Navegação">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.exato}
                className={({ isActive }) =>
                  `mobile-menu__link${isActive ? ' is-active' : ''}`
                }
              >
                {link.rotulo}
              </NavLink>
            ))}
            <NavLink to="/conta" className="mobile-menu__link">
              <User size={16} aria-hidden="true" />
              {autenticado ? 'Minha conta' : 'Entrar'}
            </NavLink>
          </nav>
        </div>
      )}
    </header>
  );
}
