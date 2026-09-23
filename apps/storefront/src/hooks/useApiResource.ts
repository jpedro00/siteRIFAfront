import { useCallback, useEffect, useState } from 'react';

/**
 * Carregamento de um recurso da API com os quatro estados que toda tela
 * precisa ter: carregando, erro, vazio e pronto.
 *
 * Existe para que nenhuma pagina precise repetir `useState` tres vezes e
 * esquecer um dos casos — o esquecido costuma ser o de erro, e a tela fica
 * girando para sempre.
 *
 * `cancelado` protege contra a resposta que chega depois de a pessoa ja ter
 * saido da tela: sem isso o React reclama de atualizar componente
 * desmontado e, pior, uma resposta lenta de um sorteio pode sobrescrever a
 * de outro que a pessoa abriu no meio tempo.
 */
export type ResourceStatus = 'loading' | 'ready' | 'error';

export interface Resource<T> {
  readonly status: ResourceStatus;
  readonly data: T | null;
  readonly error: unknown;
  reload(): void;
}

export function useApiResource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
): Resource<T> {
  const [status, setStatus] = useState<ResourceStatus>('loading');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    let cancelado = false;
    const controller = new AbortController();

    setStatus('loading');
    setError(null);

    fetcher(controller.signal)
      .then((resultado) => {
        if (cancelado) return;
        setData(resultado);
        setStatus('ready');
      })
      .catch((falha: unknown) => {
        // Abortar e uma saida normal (a pessoa navegou), nao um erro de tela.
        if (cancelado || controller.signal.aborted) return;
        setError(falha);
        setStatus('error');
      });

    return () => {
      cancelado = true;
      controller.abort();
    };
    // `fetcher` fica FORA das dependencias de proposito: quem chama costuma
    // passar uma seta criada na propria renderizacao, que e uma funcao nova a
    // cada passagem — inclui-la aqui produziria um laco infinito de
    // requisicoes. Quem controla a recarga e `deps` e `token`.
  }, [...deps, token]);

  const reload = useCallback(() => setToken((n) => n + 1), []);

  return { status, data, error, reload };
}
