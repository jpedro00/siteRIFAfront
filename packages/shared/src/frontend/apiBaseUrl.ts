const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export interface ApiBaseUrlOptions {
  readonly production: boolean;
  readonly developmentFallback?: string;
}

/**
 * Resolve a URL pública da API sem permitir o antigo fallback silencioso para
 * localhost num bundle de produção.
 */
export function resolveApiBaseUrl(
  configuredValue: string | undefined,
  options: ApiBaseUrlOptions,
): string {
  const configured = configuredValue?.trim();
  const raw =
    configured || (!options.production ? options.developmentFallback ?? 'http://localhost:3000' : '');

  if (!raw) {
    throw new Error(
      'VITE_API_BASE_URL não foi configurada. Defina a URL HTTPS da API no ambiente de hospedagem.',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('VITE_API_BASE_URL precisa ser uma URL absoluta http(s).');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('VITE_API_BASE_URL aceita somente http:// ou https://.');
  }

  if (options.production && LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(
      'VITE_API_BASE_URL aponta para localhost/loopback em produção. Configure a API publicada no Render.',
    );
  }

  return raw.replace(/\/+$/, '');
}
