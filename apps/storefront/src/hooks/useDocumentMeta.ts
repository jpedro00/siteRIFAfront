import { useEffect } from 'react';

/**
 * Titulo e meta tags de compartilhamento da pagina.
 *
 * O QUE ISTO FAZ E O QUE NAO FAZ. Atualiza `<title>`, `description` e as tags Open
 * Graph/Twitter em tempo de execucao. Isso vale para quem le a pagina no navegador
 * e para os rastreadores que EXECUTAM JavaScript (Google, por exemplo). Os
 * "cartoes" de WhatsApp, Facebook e Telegram NAO executam JavaScript: eles leem so o
 * HTML que o servidor entrega, e numa aplicacao de pagina unica esse HTML e o mesmo
 * para todo sorteio. Para o cartao mostrar a capa de CADA sorteio e preciso entrega-lo
 * ja montado (pre-renderizacao ou renderizacao no servidor) — decisao de infraestrutura
 * ainda em aberto, registrada como Suposicao S-OG1.
 *
 * Ao sair da pagina, restaura o que havia: navegar de um sorteio para outra tela nao
 * pode deixar o titulo do sorteio anterior.
 */
export interface DocumentMeta {
  readonly title: string;
  readonly description?: string | null | undefined;
  /** URL absoluta (https) da capa. Ignorada se nao for https. */
  readonly image?: string | null | undefined;
}

function definir(atributo: 'name' | 'property', chave: string, valor: string | null): () => void {
  const seletor = `meta[${atributo}="${chave}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(seletor);
  const existia = el !== null;
  const anterior = el?.getAttribute('content') ?? null;

  if (valor === null) return () => undefined;

  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(atributo, chave);
    document.head.appendChild(el);
  }
  el.setAttribute('content', valor);

  return () => {
    if (!existia) el?.remove();
    else if (anterior !== null) el?.setAttribute('content', anterior);
  };
}

export function useDocumentMeta({ title, description, image }: DocumentMeta): void {
  useEffect(() => {
    const tituloAnterior = document.title;
    document.title = title;

    const capa = image && /^https:\/\//i.test(image) ? image : null;
    const texto = description?.trim() ? description.trim().slice(0, 200) : null;

    const desfazer = [
      definir('property', 'og:title', title),
      definir('property', 'og:type', 'website'),
      definir('property', 'og:description', texto),
      definir('name', 'description', texto),
      definir('property', 'og:image', capa),
      definir('name', 'twitter:card', capa ? 'summary_large_image' : 'summary'),
      definir('name', 'twitter:title', title),
      definir('name', 'twitter:image', capa),
    ];

    return () => {
      document.title = tituloAnterior;
      for (const f of desfazer) f();
    };
  }, [title, description, image]);
}
