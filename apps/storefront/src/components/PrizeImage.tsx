import { useState } from 'react';
import { Gift } from 'lucide-react';

/**
 * Imagem do premio.
 *
 * Duas decisoes deliberadas:
 *
 * 1. NENHUMA imagem externa de exemplo. Um sorteio sem foto recebe um
 *    marcador desenhado em CSS, nao uma moto aleatoria de banco de imagens:
 *    a vitrine mostra o premio REAL ou diz que ainda nao ha foto. Ilustrar
 *    um premio com a foto de outro e propaganda enganosa por descuido.
 *
 * 2. A falha de carregamento cai no MESMO marcador. URL quebrada — e elas
 *    quebram — nao pode virar icone de imagem partida em cima do produto que
 *    se esta tentando vender.
 *
 * `aspect-ratio` no CSS reserva o espaco antes de a imagem chegar, entao o
 * texto abaixo nao salta quando ela carrega.
 */
export function PrizeImage({
  url,
  alt,
  ratio = 'wide',
  priority = false,
}: {
  url: string | null;
  alt: string;
  ratio?: 'wide' | 'square';
  priority?: boolean;
}) {
  const [falhou, setFalhou] = useState(false);
  const classe = `prize-image prize-image--${ratio}`;

  if (!url || falhou) {
    return (
      <div className={`${classe} prize-image--empty`} role="img" aria-label={`${alt} (sem foto)`}>
        <Gift size={28} strokeWidth={1.5} aria-hidden="true" />
        <span className="prize-image__caption">Sem imagem do prêmio</span>
      </div>
    );
  }

  return (
    <div className={classe}>
      <img
        src={url}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        // A imagem do topo e o maior elemento da tela: decodifica-la de forma
        // sincrona evita o piscar entre o espaco reservado e a foto.
        decoding={priority ? 'sync' : 'async'}
        onError={() => setFalhou(true)}
      />
    </div>
  );
}
