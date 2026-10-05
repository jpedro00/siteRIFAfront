/**
 * Endereco de uma imagem guardada no campo de imagem.
 *
 * - `/api/public/media/<uuid>`: imagem enviada pelo organizador; mora na API, entao
 *   o endereco absoluto e `apiBaseUrl + caminho`.
 * - `https://...`: link externo, usado como esta.
 * - qualquer outra coisa (http, javascript:, data:): nada. A vitrine nunca carrega isso.
 */
const MEDIA_PATH = /^\/api\/public\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function mediaSrc(ref: string | null | undefined, apiBaseUrl: string): string | null {
  if (!ref) return null;
  const valor = ref.trim();
  if (MEDIA_PATH.test(valor)) return `${apiBaseUrl.replace(/\/+$/, '')}${valor}`;
  if (/^https:\/\//i.test(valor)) return valor;
  return null;
}
