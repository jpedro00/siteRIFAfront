import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Onde a pagina comeca depois de uma navegacao.
 *
 * O PROBLEMA CONCRETO. Numa aplicacao de pagina unica o navegador nao rola
 * para o topo sozinho: trocar de rota troca o conteudo e mantem a posicao de
 * rolagem. Quem escolhia numeros no meio da grade e clicava em "Reservar"
 * caia no checkout JA ROLADO — abaixo do titulo, do link de voltar e, o que
 * importa de verdade, abaixo do CRONOMETRO da reserva. A contagem de 30
 * minutos existia, estava correta e simplesmente nao era vista, porque a
 * tela abria adiante dela.
 *
 * POR QUE NAO ROLAR SEMPRE. Voltar e avancar sao o caso oposto: quem volta do
 * detalhe para o catalogo espera reencontrar o card de onde saiu, e nao o topo
 * da lista. Por isso a decisao olha o TIPO da navegacao:
 *
 *   PUSH / REPLACE  rota nova  -> topo
 *   POP             voltar/avancar -> o navegador restaura, nao mexemos
 *
 * `history.scrollRestoration` NAO e tocado, de proposito. Coloca-lo em
 * 'manual' — a primeira versao disto fazia isso — desliga justamente a
 * restauracao que queremos no POP, e voltar passa a cair no topo. O padrao
 * 'auto' ja faz o certo: restaura no POP e nao mexe no PUSH, que e onde este
 * componente entra.
 *
 * LIMITE CONHECIDO, e nao introduzido aqui: a restauracao do navegador depende
 * de a pagina ja ter altura quando ele tenta rolar. Como o conteudo chega por
 * requisicao depois da montagem, voltar para uma lista longa pode cair perto do
 * topo mesmo assim. Resolver isso exige guardar a posicao por rota e reaplicar
 * quando o dado chega — mudanca maior, registrada como pendencia em vez de
 * improvisada aqui.
 *
 * Ancoras (`#secao`) tambem sao respeitadas: se a URL tem hash, o alvo dela
 * ganha a preferencia sobre o topo.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    // Voltar/avancar: a posicao pertence ao historico do navegador.
    if (navigationType === 'POP') return;

    if (hash) {
      const alvo = document.querySelector(hash);
      if (alvo) {
        alvo.scrollIntoView({ behavior: 'auto', block: 'start' });
        return;
      }
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, hash, navigationType]);

  return null;
}
