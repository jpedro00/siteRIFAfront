import { Link } from 'react-router-dom';
import { Ticket } from 'lucide-react';
import { useStorefront } from '../state/SessionProvider.tsx';

/**
 * Rodape publico.
 *
 * Deliberadamente curto. Rodape de vitrine existe para fechar a pagina e dar
 * o minimo de contexto institucional — nao para virar mapa do site com links
 * que nao levam a lugar nenhum.
 */
export function PublicFooter() {
  const { tenant } = useStorefront();
  const nome = tenant?.publicName ?? tenant?.name ?? 'Comunidade';
  const ano = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div className="site-footer__brand">
          <span className="site-footer__mark" aria-hidden="true">
            <Ticket size={16} />
          </span>
          <div>
            <p className="site-footer__name">{nome}</p>
            <p className="site-footer__tagline">Sorteios organizados com transparência.</p>
          </div>
        </div>

        <nav className="site-footer__nav" aria-label="Navegação do rodapé">
          <Link to="/">Início</Link>
          <Link to="/sorteios">Sorteios</Link>
          <Link to="/conta">Minha conta</Link>
        </nav>

        <p className="site-footer__legal">
          © {ano} {nome}. Participe apenas se tiver 18 anos ou mais.
        </p>
      </div>
    </footer>
  );
}
