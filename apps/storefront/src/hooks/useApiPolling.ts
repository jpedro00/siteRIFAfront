import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Carrega um recurso e o MANTEM ATUALIZADO, sem piscar.
 *
 * Diferente de `useApiResource` (uma carga so), este re-consulta a cada
 * `intervalMs`. Foi feito para a grade de numeros e para o status do PIX, onde o
 * dado muda por causa de OUTRAS pessoas e a tela precisa acompanhar.
 *
 * COMPORTAMENTO
 *  - a primeira carga tem estado `loading`; as seguintes NAO: a tela continua
 *    mostrando o ultimo dado bom enquanto a nova consulta corre, e so re-renderiza
 *    se o conteudo MUDOU (com o ETag da API, o mais comum e nada ter mudado);
 *  - uma consulta so comeca depois de a anterior terminar: nunca ha duas em voo;
 *  - aba escondida PAUSA o ciclo, e voltar a ela consulta na hora — polling em aba
 *    que ninguem ve e custo sem beneficio;
 *  - falha de rede NAO derruba a tela: o ultimo dado fica, `stale` vira verdadeiro
 *    (a tela avisa "sem conexao") e o intervalo cresce (recuo exponencial, ate 30 s)
 *    para nao martelar um servidor que ja esta com problema;
 *  - `revalidate: true` na chamada faz o navegador mandar `If-None-Match`, e o
 *    servidor responder 304 sem corpo quando nada mudou.
 */
export type PollingStatus = 'loading' | 'ready' | 'error';

export interface PolledResource<T> {
  readonly status: PollingStatus;
  readonly data: T | null;
  readonly error: unknown;
  /** A ULTIMA consulta falhou, mas ha dado anterior na tela. */
  readonly stale: boolean;
  /** Consulta agora, sem esperar o proximo ciclo. */
  reload(): void;
}

export interface PollingOptions<T> {
  readonly intervalMs: number;
  /** Desligado, so a carga inicial acontece (por exemplo, pedido ja pago). */
  readonly enabled?: boolean;
  readonly isEqual?: (a: T, b: T) => boolean;
}

const TETO_DO_RECUO_MS = 30_000;

const igualPorJson = <T>(a: T, b: T): boolean => JSON.stringify(a) === JSON.stringify(b);

export function useApiPolling<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
  options: PollingOptions<T>,
): PolledResource<T> {
  const { intervalMs, enabled = true, isEqual = igualPorJson } = options;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const [status, setStatus] = useState<PollingStatus>('loading');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [stale, setStale] = useState(false);
  const [token, setToken] = useState(0);

  // O fetcher e a comparacao mudam a cada render; guardar em ref evita reiniciar o
  // ciclo sem motivo (e o laco infinito de requisicoes que isso causaria).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const igualRef = useRef(isEqual);
  igualRef.current = isEqual;
  const ultimoRef = useRef<T | null>(null);
  const agoraRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    let cancelado = false;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    let falhasSeguidas = 0;

    ultimoRef.current = null;
    setStatus('loading');
    setData(null);
    setError(null);
    setStale(false);

    const agendar = (): void => {
      // `enabled` e lido por ref: ligar/desligar NAO reinicia o hook nem apaga o dado.
      if (cancelado || !enabledRef.current) return;
      const espera = Math.min(intervalMs * 2 ** falhasSeguidas, TETO_DO_RECUO_MS);
      timer = window.setTimeout(() => void consultar(), espera);
    };

    const consultar = async (): Promise<void> => {
      if (cancelado) return;
      // Aba escondida: nao consulta. `visibilitychange` retoma.
      if (document.hidden && ultimoRef.current !== null) {
        agendar();
        return;
      }

      controller?.abort();
      controller = new AbortController();
      try {
        const resultado = await fetcherRef.current(controller.signal);
        if (cancelado) return;
        falhasSeguidas = 0;
        setStale(false);
        setError(null);
        // So re-renderiza se mudou.
        if (ultimoRef.current === null || !igualRef.current(ultimoRef.current, resultado)) {
          ultimoRef.current = resultado;
          setData(resultado);
        }
        setStatus('ready');
      } catch (falha) {
        if (cancelado || controller.signal.aborted) return;
        falhasSeguidas += 1;
        if (ultimoRef.current === null) {
          // Nada para mostrar ainda: e erro de tela.
          setError(falha);
          setStatus('error');
        } else {
          // Ja ha dado bom: a tela fica de pe e avisa que esta desatualizada.
          setStale(true);
        }
      }
      agendar();
    };

    agoraRef.current = () => {
      window.clearTimeout(timer);
      void consultar();
    };

    const aoVoltar = (): void => {
      if (!document.hidden) agoraRef.current();
    };
    document.addEventListener('visibilitychange', aoVoltar);

    void consultar();

    return () => {
      cancelado = true;
      window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', aoVoltar);
    };
    // `fetcher`, `isEqual` e `enabled` ficam FORA das dependencias: ver os refs.
  }, [...deps, intervalMs, token]);

  // Voltou a ligar (por exemplo, um pagamento que ainda pode mudar): retoma o ciclo.
  useEffect(() => {
    if (enabled && ultimoRef.current !== null) agoraRef.current();
  }, [enabled]);

  const reload = useCallback(() => {
    // Sem dado ainda (erro na carga inicial): recomeca do zero, com o spinner.
    if (ultimoRef.current === null) setToken((n) => n + 1);
    else agoraRef.current();
  }, []);

  return { status, data, error, stale, reload };
}
