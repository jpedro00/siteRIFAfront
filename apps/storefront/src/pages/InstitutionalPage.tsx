import { Link, useParams } from 'react-router-dom';
import { COMMUNITY_PAGE_KEYS, COMMUNITY_PAGE_LABELS, type CommunityPageKey } from '@clubedarifa/shared';
import { NotFoundState } from '../components/States.tsx';
import { useDocumentMeta } from '../hooks/useDocumentMeta.ts';
import { useStorefront } from '../state/SessionProvider.tsx';

/**
 * Paginas institucionais da comunidade (Sobre, Como funciona, Termos, Privacidade, Contato).
 * O texto vem do que o organizador salvou em Comunidade. "Como funciona" tem um texto
 * padrao verdadeiro sobre a plataforma quando a comunidade ainda nao escreveu o seu.
 */
const COMO_FUNCIONA_PADRAO = [
  'Escolha um sorteio e os números que quiser. A reserva dura 30 minutos para você concluir o pagamento.',
  'Informe seus dados e pague por PIX. Assim que o pagamento é confirmado, seus números ficam garantidos.',
  'No dia do sorteio, o resultado é apurado pela regra publicada no regulamento e fica disponível, com a prova, na página do sorteio.',
];

export function isPageKey(valor: string | undefined): valor is CommunityPageKey {
  return COMMUNITY_PAGE_KEYS.some((k) => k === valor);
}

/** Paginas com conteudo (ou com texto padrao), na ordem do rodape. */
export function availablePages(pages: Record<string, string> | undefined): CommunityPageKey[] {
  return COMMUNITY_PAGE_KEYS.filter((k) => Boolean(pages?.[k]?.trim()) || k === 'howItWorks');
}

export function InstitutionalPage() {
  const { key } = useParams();
  const { tenant } = useStorefront();
  const nome = tenant?.publicName ?? tenant?.name ?? 'Comunidade';
  const pagina = isPageKey(key) ? key : null;
  const titulo = pagina ? COMMUNITY_PAGE_LABELS[pagina] : 'Página';

  useDocumentMeta({ title: `${titulo} · ${nome}`, description: null });

  if (!pagina) {
    return (
      <div className="container page">
        <NotFoundState action={<Link className="btn btn--primary" to="/">Ir para o início</Link>} />
      </div>
    );
  }

  const texto = tenant?.pages[pagina]?.trim() ?? '';
  const paragrafos = (texto ? texto : pagina === 'howItWorks' ? COMO_FUNCIONA_PADRAO.join('\n\n') : '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="container page institutional">
      <Link className="back-link" to="/">
        Voltar ao início
      </Link>
      <article className="prose institutional__body">
        <h1 className="draw-page__title">{titulo}</h1>
        {paragrafos.length > 0 ? (
          paragrafos.map((p, i) => (
            <p key={i} className="prose__pre">
              {p}
            </p>
          ))
        ) : (
          <p className="muted">Esta comunidade ainda não publicou esta página.</p>
        )}
      </article>
    </div>
  );
}
