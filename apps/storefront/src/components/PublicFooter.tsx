import { Link } from 'react-router-dom';
import { AtSign, Mail, MessageCircle, Phone, Ticket } from 'lucide-react';
import { COMMUNITY_PAGE_LABELS } from '@clubedarifa/shared';
import { useStorefront } from '../state/SessionProvider.tsx';
import { instagramLink, whatsappLink } from '../lib/brand.ts';
import { availablePages } from '../pages/InstitutionalPage.tsx';
import { IS_CENTRAL, PLATFORM_NAME } from '../lib/mode.ts';

/**
 * Rodape publico.
 *
 * Mostra o que a comunidade configurou (texto do rodape, contatos, redes e paginas).
 * Contato que nao foi preenchido nao aparece; link de rede social so se for valido.
 */
export function PublicFooter() {
  const { tenant } = useStorefront();
  if (IS_CENTRAL) {
    return (
      <footer className="site-footer">
        <div className="container site-footer__inner">
          <div className="site-footer__brand">
            <span className="site-footer__mark" aria-hidden="true">
              <Ticket size={16} />
            </span>
            <div>
              <p className="site-footer__name">{PLATFORM_NAME}</p>
              <p className="site-footer__tagline">Rifas de criadores, com reserva segura e pagamento por PIX.</p>
            </div>
          </div>
          <nav className="site-footer__nav" aria-label="Navegação do rodapé">
            <Link to="/">Início</Link>
            <Link to="/sorteios">Rifas</Link>
            <Link to="/quero-criar-rifas">Quero criar rifas</Link>
            <Link to="/conta">Minha conta</Link>
          </nav>
          <p className="site-footer__legal">© {new Date().getFullYear()} {PLATFORM_NAME}. Participe apenas se tiver 18 anos ou mais.</p>
        </div>
      </footer>
    );
  }
  const nome = tenant?.publicName ?? tenant?.name ?? 'Comunidade';
  const ano = new Date().getFullYear();
  const contato = tenant?.contact ?? {};
  const whatsapp = whatsappLink(contato['whatsapp']);
  const instagram = instagramLink(contato['instagram']);
  const email = contato['email'];
  const telefone = contato['phone'];
  const paginas = availablePages(tenant?.pages);

  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div className="site-footer__brand">
          <span className="site-footer__mark" aria-hidden="true">
            <Ticket size={16} />
          </span>
          <div>
            <p className="site-footer__name">{nome}</p>
            <p className="site-footer__tagline">{tenant?.footerText ?? 'Sorteios organizados com transparência.'}</p>
          </div>
        </div>

        <nav className="site-footer__nav" aria-label="Navegação do rodapé">
          <Link to="/">Início</Link>
          <Link to="/sorteios">Sorteios</Link>
          <Link to="/conta">Minha conta</Link>
          {paginas.map((k) => (
            <Link key={k} to={`/p/${k}`}>
              {COMMUNITY_PAGE_LABELS[k]}
            </Link>
          ))}
        </nav>

        {(whatsapp || instagram || email || telefone) && (
          <ul className="site-footer__contact" aria-label="Contato">
            {whatsapp && (
              <li>
                <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={14} aria-hidden="true" /> WhatsApp
                </a>
              </li>
            )}
            {instagram && (
              <li>
                <a href={instagram} target="_blank" rel="noopener noreferrer">
                  <AtSign size={14} aria-hidden="true" /> Instagram
                </a>
              </li>
            )}
            {email && (
              <li>
                <a href={`mailto:${email}`}>
                  <Mail size={14} aria-hidden="true" /> {email}
                </a>
              </li>
            )}
            {telefone && (
              <li>
                <Phone size={14} aria-hidden="true" /> {telefone}
              </li>
            )}
          </ul>
        )}

        <p className="site-footer__legal">
          © {ano} {nome}. Participe apenas se tiver 18 anos ou mais.
        </p>
      </div>
    </footer>
  );
}
