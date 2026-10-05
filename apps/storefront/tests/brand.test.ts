import { describe, expect, it } from 'vitest';
import { mediaSrc } from '@clubedarifa/shared';
import { instagramLink, safeAccent, whatsappLink } from '../src/lib/brand.ts';

describe('marca da comunidade na vitrine', () => {
  it('cor de destaque so vale se o texto branco continuar legivel (contraste 4,5:1)', () => {
    expect(safeAccent('#1d4ed8')).toBe('#1d4ed8');
    expect(safeAccent('#16a34a')).toBeNull(); // verde claro demais para texto branco
    expect(safeAccent('#ffff00')).toBeNull();
    expect(safeAccent('azul')).toBeNull();
    expect(safeAccent('#1d4ed8; background:url(x)')).toBeNull();
    expect(safeAccent(null)).toBeNull();
  });

  it('imagem: enviada vira endereco da API; https passa; o resto nunca carrega', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(mediaSrc(`/api/public/media/${id}`, 'https://api.exemplo/')).toBe(`https://api.exemplo/api/public/media/${id}`);
    expect(mediaSrc('https://cdn.exemplo/a.png', 'https://api.exemplo')).toBe('https://cdn.exemplo/a.png');
    expect(mediaSrc('http://cdn.exemplo/a.png', 'https://api.exemplo')).toBeNull();
    expect(mediaSrc('javascript:alert(1)', 'https://api.exemplo')).toBeNull();
    expect(mediaSrc('/api/public/media/../../x', 'https://api.exemplo')).toBeNull();
    expect(mediaSrc(null, 'https://api.exemplo')).toBeNull();
  });

  it('links de contato: WhatsApp so com telefone plausivel; Instagram so com usuario valido', () => {
    expect(whatsappLink('(11) 99999-0000')).toBe('https://wa.me/5511999990000');
    expect(whatsappLink('+55 11 99999-0000')).toBe('https://wa.me/5511999990000');
    expect(whatsappLink('123')).toBeNull();
    expect(instagramLink('@clubeazul')).toBe('https://instagram.com/clubeazul');
    expect(instagramLink('https://instagram.com/clubeazul')).toBe('https://instagram.com/clubeazul');
    expect(instagramLink('javascript:alert(1)')).toBeNull();
    expect(instagramLink('a b')).toBeNull();
  });
});
