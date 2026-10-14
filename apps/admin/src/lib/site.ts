/**
 * Enderecos do site publico a partir do Admin. Configuracao de build (`VITE_STOREFRONT_BASE_URL`);
 * sem ela as funcoes devolvem null e a tela nao mostra o link. O Admin NUNCA oferece criar conta:
 * administrador de plataforma nao tem cadastro publico.
 */
const BASE: string | null = (() => {
  const raw = import.meta.env['VITE_STOREFRONT_BASE_URL'] as string | undefined;
  return raw && /^https?:\/\//.test(raw) ? raw.replace(/\/+$/, '') : null;
})();

export function esqueciSenhaUrl(): string | null {
  return BASE ? `${BASE}/esqueci-senha` : null;
}

export function clubeUrl(): string | null {
  return BASE ? `${BASE}/` : null;
}
