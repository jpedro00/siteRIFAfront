import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Lista paginada por cursor com busca. A primeira pagina e recarregada quando os filtros mudam;
 * "carregar mais" acrescenta a proxima sem repetir linhas. Uma resposta que chega depois de os
 * filtros terem mudado e descartada, para uma busca lenta nao sobrescrever a mais nova.
 */
export interface CursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

export function useCursorList<T>(
  fetchPage: (cursor: string | null) => Promise<CursorPage<T>>,
  filtros: readonly unknown[],
) {
  const [items, setItems] = useState<T[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const geracao = useRef(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const reload = useCallback(async () => {
    const minha = ++geracao.current;
    setLoading(true);
    setError(null);
    try {
      const p = await fetchRef.current(null);
      if (minha !== geracao.current) return;
      setItems([...p.items]);
      setNext(p.nextCursor);
    } catch (e: unknown) {
      if (minha === geracao.current) setError(e);
    } finally {
      if (minha === geracao.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, ...filtros]);

  const loadMore = useCallback(async () => {
    if (!next) return;
    const minha = geracao.current;
    setLoadingMore(true);
    try {
      const p = await fetchRef.current(next);
      if (minha !== geracao.current) return;
      setItems((antes) => [...antes, ...p.items]);
      setNext(p.nextCursor);
    } catch (e: unknown) {
      if (minha === geracao.current) setError(e);
    } finally {
      setLoadingMore(false);
    }
  }, [next]);

  return {
    items,
    next,
    loading,
    loadingMore,
    error,
    reload: () => void reload(),
    loadMore: () => void loadMore(),
  };
}
