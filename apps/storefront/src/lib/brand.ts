import type { CSSProperties } from 'react';
import { isLegibleAccent, mediaSrc } from '@clubedarifa/shared';
import { apiBaseUrl } from '../api.ts';

/** Endereco de uma imagem guardada (enviada ou https); nulo para qualquer outra coisa. */
export const imageSrc = (ref: string | null | undefined): string | null => mediaSrc(ref, apiBaseUrl);

/**
 * Cor de destaque escolhida pelo organizador, SO se der para ler texto branco em cima dela
 * (contraste minimo 4,5:1, RN27). Cor clara demais e ignorada e vale a cor padrao: o botao
 * de compra nunca fica ilegivel.
 */
export function safeAccent(hex: string | null | undefined): string | null {
  return isLegibleAccent(hex) ? hex!.toLowerCase() : null;
}

/** Variaveis CSS que trocam a cor principal da vitrine (ou da pagina de um sorteio). */
export function accentStyle(hex: string | null | undefined): CSSProperties | undefined {
  const cor = safeAccent(hex);
  if (!cor) return undefined;
  return {
    '--primary': cor,
    '--primary-hover': `color-mix(in srgb, ${cor} 88%, black)`,
    '--primary-active': `color-mix(in srgb, ${cor} 76%, black)`,
    '--primary-soft': `color-mix(in srgb, ${cor} 12%, white)`,
    '--primary-soft-hover': `color-mix(in srgb, ${cor} 20%, white)`,
    '--primary-border': `color-mix(in srgb, ${cor} 35%, white)`,
    '--primary-text': `color-mix(in srgb, ${cor} 82%, black)`,
  } as CSSProperties;
}

/** "(11) 99999-0000" -> "5511999990000"; nulo se nao parecer telefone. */
export function whatsappLink(raw: string | undefined): string | null {
  if (!raw) return null;
  const digitos = raw.replace(/[^0-9]/g, '');
  if (digitos.length < 10 || digitos.length > 13) return null;
  const comPais = digitos.length <= 11 ? `55${digitos}` : digitos;
  return `https://wa.me/${comPais}`;
}

export function instagramLink(raw: string | undefined): string | null {
  if (!raw) return null;
  const limpo = raw.trim();
  if (/^https:\/\//i.test(limpo)) return limpo;
  const usuario = limpo.replace(/^@/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(usuario) ? `https://instagram.com/${usuario}` : null;
}
