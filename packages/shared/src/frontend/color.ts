const HEX = /^#[0-9a-fA-F]{6}$/;

function luminance(hex: string): number {
  const canal = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
}

/**
 * A cor serve de destaque se o texto BRANCO em cima dela tem contraste de pelo menos
 * 4,5:1 (RN27). Cor clara demais deixaria o botao de compra ilegivel.
 */
export function isLegibleAccent(hex: string | null | undefined): boolean {
  if (!hex || !HEX.test(hex)) return false;
  return 1.05 / (luminance(hex) + 0.05) >= 4.5;
}
