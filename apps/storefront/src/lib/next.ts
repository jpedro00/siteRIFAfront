/**
 * Destino depois do login/cadastro (`?next=`). So caminho INTERNO: comeca com uma barra e nao
 * com duas (`//evil.com`), sem esquema nem barra invertida. Qualquer outra coisa vira o padrao
 * (evita redirecionamento aberto).
 */
export function safeNext(raw: string | null | undefined, fallback: string | null = null): string | null {
  if (!raw) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  if (raw.includes('\\') || raw.includes(':')) return fallback;
  return raw;
}
