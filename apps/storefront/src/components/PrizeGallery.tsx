import { useState } from 'react';
import type { Prize } from '@clubedarifa/shared';
import { PrizeImage } from './PrizeImage.tsx';

/**
 * Galeria dos premios do sorteio.
 *
 * Um premio so: e a imagem grande, como antes. Varios: a imagem principal muda
 * conforme a miniatura escolhida, e a lista abaixo diz QUEM e cada premio (1º, 2º...).
 * A imagem sozinha nao diz o que se ganha em cada posicao — o texto sim, e e ele que o
 * leitor de tela le.
 *
 * Premio sem foto continua aparecendo na lista: a vitrine mostra o premio real ou diz
 * que ainda nao ha foto, nunca uma imagem generica no lugar.
 */
export function PrizeGallery({ prizes, fallbackName }: { prizes: readonly Prize[]; fallbackName: string }) {
  const [indice, setIndice] = useState(0);
  const ordenados = [...prizes].sort((a, b) => a.position - b.position);
  const atual = ordenados[indice] ?? ordenados[0];

  if (!atual) return <PrizeImage url={null} alt={fallbackName} priority />;

  return (
    <div className="prize-gallery">
      <PrizeImage url={atual.imageUrl} alt={atual.name} priority />

      {ordenados.length > 1 && (
        <>
          <ul className="prize-gallery__thumbs" aria-label="Fotos dos prêmios">
            {ordenados.map((p, i) => (
              <li key={p.position}>
                <button
                  type="button"
                  className={`prize-gallery__thumb${i === indice ? ' is-current' : ''}`}
                  aria-label={`Ver ${p.position}º prêmio: ${p.name}`}
                  aria-pressed={i === indice}
                  onClick={() => setIndice(i)}
                >
                  {p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" /> : <span aria-hidden="true">{p.position}º</span>}
                </button>
              </li>
            ))}
          </ul>

          <ol className="prize-gallery__list">
            {ordenados.map((p) => (
              <li key={p.position}>
                <strong>{p.position}º prêmio:</strong> {p.name}
                {p.description ? <span className="muted"> — {p.description}</span> : null}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
